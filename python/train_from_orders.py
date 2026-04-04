"""
Train XGBoost fraud model directly from the Supabase orders table.

Produces the 5 artifacts that ml_logic.py needs for inference:
  - xgboost_model.joblib
  - train_columns.joblib
  - num_imputer.joblib
  - cat_imputer.joblib
  - scaler.joblib

Usage:  python python/train_from_orders.py
"""

import os
import json
import httpx
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import xgboost as xgb
import joblib
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

# ── helpers ──────────────────────────────────────────────────────────────

def fetch_all(table, select="*"):
    """Paginate through Supabase REST API (max 1000 per page)."""
    rows = []
    offset = 0
    page_size = 1000
    while True:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=HEADERS,
            params={"select": select, "limit": str(page_size), "offset": str(offset)},
            timeout=30,
        )
        r.raise_for_status()
        page = r.json()
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


# ── 1. Load data ────────────────────────────────────────────────────────

print("Loading orders from Supabase...")
orders = pd.DataFrame(fetch_all("orders"))
print(f"  Orders: {len(orders)}")

print("Loading customers...")
customers = pd.DataFrame(fetch_all("customers"))
print(f"  Customers: {len(customers)}")

print("Loading shipments...")
shipments = pd.DataFrame(fetch_all("shipments"))
print(f"  Shipments: {len(shipments)}")

# ── 2. Join into one wide table ─────────────────────────────────────────

customers = customers.rename(columns={
    "state": "customer_state",
    "zip_code": "customer_zip",
    "created_at": "customer_created_at",
})

df = orders.merge(customers, on="customer_id", how="left")
df = df.merge(shipments, on="order_id", how="left")

print(f"\nJoined dataset: {df.shape}")
print(f"  Fraud=1: {(df['is_fraud'] == 1).sum()}")
print(f"  Fraud=0: {(df['is_fraud'] == 0).sum()}")
print(f"  Fraud rate: {df['is_fraud'].mean()*100:.1f}%")

# ── 3. Preprocess (mirrors ml_logic.py preprocess_data) ─────────────────

y = df["is_fraud"].astype(int)

drop_cols = [
    "ship_datetime", "carrier", "shipping_method", "distance_band",
    "promised_days", "actual_days", "late_delivery", "shipment_id",
    "review_id", "rating", "review_datetime", "review_text",
    "customer_id", "full_name", "email", "order_id", "order_item_id",
    "product_id", "sku", "product_name", "promo_code",
    "order_total", "line_total",
    "is_fraud", "fraud_predicted", "fraud_probability", "admin_fraud_confirmed",
    "is_active", "city", "customer_segment", "loyalty_tier", "gender",
]
X = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

# Date / time features
for col in ["order_datetime", "birthdate", "customer_created_at"]:
    if col in X.columns:
        X[col] = pd.to_datetime(X[col], errors="coerce")

if {"order_datetime", "birthdate", "customer_created_at"}.issubset(X.columns):
    X["customer_age"] = ((X["order_datetime"] - X["birthdate"]).dt.days / 365.25).round(1)
    X["customer_tenure_days"] = (X["order_datetime"] - X["customer_created_at"]).dt.days
    X["order_hour"] = X["order_datetime"].dt.hour
    X["order_dow"] = X["order_datetime"].dt.dayofweek
    X["order_month"] = X["order_datetime"].dt.month
    X["is_weekend"] = X["order_dow"].isin([5, 6]).astype(int)
    X.drop(columns=["order_datetime", "birthdate", "customer_created_at"], inplace=True, errors="ignore")

# Structural fraud-signal features
if "billing_zip" in X.columns and "shipping_zip" in X.columns:
    X["billing_shipping_zip_match"] = (X["billing_zip"] == X["shipping_zip"]).astype(int)
if "customer_state" in X.columns and "shipping_state" in X.columns:
    X["state_mismatch"] = (X["customer_state"] != X["shipping_state"]).astype(int)

X.drop(columns=["customer_zip", "billing_zip", "shipping_zip"], inplace=True, errors="ignore")

# Separate numeric / categorical
num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

print(f"\nFeatures: {len(num_cols)} numeric, {len(cat_cols)} categorical")
print(f"  Numeric:     {num_cols}")
print(f"  Categorical: {cat_cols}")

# Fit imputers
num_imputer = SimpleImputer(strategy="median")
cat_imputer = SimpleImputer(strategy="most_frequent")

if num_cols:
    X[num_cols] = num_imputer.fit_transform(X[num_cols])
if cat_cols:
    X[cat_cols] = cat_imputer.fit_transform(X[cat_cols])

# One-hot encode
X_enc = pd.get_dummies(X, columns=cat_cols, drop_first=True, dtype=int)

train_columns = X_enc.columns.tolist()

# Standard scale numeric features
scaler = StandardScaler()
valid_scale_cols = [c for c in num_cols if c in X_enc.columns]
if valid_scale_cols:
    X_enc[valid_scale_cols] = scaler.fit_transform(X_enc[valid_scale_cols])

print(f"  Final feature count: {len(train_columns)}")

# ── 4. Train / test split ───────────────────────────────────────────────

X_train, X_test, y_train, y_test = train_test_split(
    X_enc, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train)}  |  Test: {len(X_test)}")

# ── 5. Train XGBoost ────────────────────────────────────────────────────

scale_pos_weight = (len(y_train) - y_train.sum()) / max(y_train.sum(), 1)

model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    use_label_encoder=False,
)

print("\nTraining XGBoost...")
model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=10,
)

# ── 6. Evaluate ─────────────────────────────────────────────────────────

y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

accuracy  = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, zero_division=0)
recall    = recall_score(y_test, y_pred, zero_division=0)
f1        = f1_score(y_test, y_pred, zero_division=0)
auc       = roc_auc_score(y_test, y_proba)
cm        = confusion_matrix(y_test, y_pred)

print("\n" + "=" * 50)
print("MODEL PERFORMANCE")
print("=" * 50)
print(f"Accuracy:  {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall:    {recall:.4f}")
print(f"F1-Score:  {f1:.4f}")
print(f"ROC-AUC:   {auc:.4f}")
print(f"\nConfusion matrix:")
print(f"  TN={cm[0,0]}  FP={cm[0,1]}")
print(f"  FN={cm[1,0]}  TP={cm[1,1]}")

# ── 7. Save artifacts to python/ ────────────────────────────────────────

print(f"\nSaving artifacts to {BASE_DIR}/ ...")
joblib.dump(model,         os.path.join(BASE_DIR, "xgboost_model.joblib"))
joblib.dump(train_columns, os.path.join(BASE_DIR, "train_columns.joblib"))
joblib.dump(num_imputer,   os.path.join(BASE_DIR, "num_imputer.joblib"))
joblib.dump(cat_imputer,   os.path.join(BASE_DIR, "cat_imputer.joblib"))
joblib.dump(scaler,        os.path.join(BASE_DIR, "scaler.joblib"))

print("  xgboost_model.joblib")
print("  train_columns.joblib")
print("  num_imputer.joblib")
print("  cat_imputer.joblib")
print("  scaler.joblib")
print("\nDone! The ML pipeline will now use the real XGBoost model.")
