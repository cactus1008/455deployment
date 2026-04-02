"""
ML Service Module - Fraud Detection via XGBoost
Converted from Jupyter notebook training pipeline.

This module loads pre-trained artifacts and performs inference on transaction data.

Required artifacts (in same directory as this script):
- xgboost_model.joblib
- num_imputer.joblib
- cat_imputer.joblib
- scaler.joblib
- train_columns.joblib
"""

import os
import joblib
import pandas as pd
import numpy as np
import json

# Set base directory to the location of this script for robust path handling
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define paths to serialized artifacts expected from the training notebook
MODEL_PATH = os.path.join(BASE_DIR, 'xgboost_model.joblib')
NUM_IMPUTER_PATH = os.path.join(BASE_DIR, 'num_imputer.joblib')
CAT_IMPUTER_PATH = os.path.join(BASE_DIR, 'cat_imputer.joblib')
SCALER_PATH = os.path.join(BASE_DIR, 'scaler.joblib')
TRAIN_COLUMNS_PATH = os.path.join(BASE_DIR, 'train_columns.joblib')

def check_artifacts_exist():
    """
    Check if all required model artifacts exist.
    Returns: (bool, list) - (all_exist, missing_files)
    """
    required_files = {
        'Model': MODEL_PATH,
        'Numeric Imputer': NUM_IMPUTER_PATH,
        'Categorical Imputer': CAT_IMPUTER_PATH,
        'Scaler': SCALER_PATH,
        'Train Columns': TRAIN_COLUMNS_PATH
    }
    
    missing = []
    for name, path in required_files.items():
        if not os.path.exists(path):
            missing.append(f"{name} ({path})")
    
    return len(missing) == 0, missing

def load_artifacts():
    """
    Load pre-trained artifacts from disk.
    Assumes models and preprocessors were exported appropriately.
    """
    all_exist, missing = check_artifacts_exist()
    if not all_exist:
        raise FileNotFoundError(f"Missing model artifacts:\n" + "\n".join(missing))
    
    model = joblib.load(MODEL_PATH)
    num_imputer = joblib.load(NUM_IMPUTER_PATH)
    cat_imputer = joblib.load(CAT_IMPUTER_PATH)
    scaler = joblib.load(SCALER_PATH)
    train_columns = joblib.load(TRAIN_COLUMNS_PATH)
    return model, num_imputer, cat_imputer, scaler, train_columns

def preprocess_data(df, num_imputer, cat_imputer, scaler, train_columns):
    """
    Preprocess the raw input dataframe using loaded artifacts and predefined steps.
    """
    df_clean = df.copy()

    # 1. Drop post-transaction, identifier, and redundant columns
    drop_cols = [
        'ship_datetime', 'carrier', 'shipping_method', 'distance_band',
        'promised_days', 'actual_days', 'late_delivery', 'shipment_id',
        'review_id', 'rating', 'review_datetime', 'review_text',
        'customer_id', 'full_name', 'email', 'order_id', 'order_item_id',
        'product_id', 'sku', 'product_name', 'promo_code',
        'order_total', 'line_total'
    ]
    df_clean = df_clean.drop(columns=[c for c in drop_cols if c in df_clean.columns], errors='ignore')

    # 2. Date/Time feature engineering
    if set(['order_datetime', 'birthdate', 'customer_created_at']).issubset(df_clean.columns):
        df_clean['order_datetime'] = pd.to_datetime(df_clean['order_datetime'], errors='coerce')
        df_clean['birthdate'] = pd.to_datetime(df_clean['birthdate'], errors='coerce')
        df_clean['customer_created_at'] = pd.to_datetime(df_clean['customer_created_at'], errors='coerce')

        df_clean['customer_age'] = ((df_clean['order_datetime'] - df_clean['birthdate']).dt.days / 365.25).round(1)
        df_clean['customer_tenure_days'] = (df_clean['order_datetime'] - df_clean['customer_created_at']).dt.days
        df_clean['order_hour'] = df_clean['order_datetime'].dt.hour
        df_clean['order_dow'] = df_clean['order_datetime'].dt.dayofweek
        df_clean['order_month'] = df_clean['order_datetime'].dt.month
        df_clean['is_weekend'] = df_clean['order_dow'].isin([5, 6]).astype(int)

        df_clean.drop(columns=['order_datetime', 'birthdate', 'customer_created_at'], inplace=True, errors='ignore')

    # 3. Structural fraud-signal features
    if 'billing_zip' in df_clean.columns and 'shipping_zip' in df_clean.columns:
        df_clean['billing_shipping_zip_match'] = (df_clean['billing_zip'] == df_clean['shipping_zip']).astype(int)
    if 'customer_state' in df_clean.columns and 'shipping_state' in df_clean.columns:
        df_clean['state_mismatch'] = (df_clean['customer_state'] != df_clean['shipping_state']).astype(int)

    df_clean.drop(columns=['customer_zip', 'billing_zip', 'shipping_zip'], inplace=True, errors='ignore')

    # Ensure target variable is not in inference features
    if 'is_fraud' in df_clean.columns:
        df_clean.drop(columns=['is_fraud'], inplace=True, errors='ignore')

    # 4. Separate numeric and categorical features
    num_cols = df_clean.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df_clean.select_dtypes(exclude=[np.number]).columns.tolist()

    # 5. Missing value imputation
    if num_cols:
        expected_num_cols = num_imputer.feature_names_in_ if hasattr(num_imputer, 'feature_names_in_') else num_cols
        common_num = [c for c in num_cols if c in expected_num_cols]
        if common_num:
            df_clean[common_num] = num_imputer.transform(df_clean[common_num])

    if cat_cols:
        expected_cat_cols = cat_imputer.feature_names_in_ if hasattr(cat_imputer, 'feature_names_in_') else cat_cols
        common_cat = [c for c in cat_cols if c in expected_cat_cols]
        if common_cat:
            df_clean[common_cat] = cat_imputer.transform(df_clean[common_cat])

    # 6. One-hot encoding
    df_enc = pd.get_dummies(df_clean, columns=cat_cols, drop_first=True, dtype=int)

    # 7. Re-align columns with training schema
    df_enc = df_enc.reindex(columns=train_columns, fill_value=0)

    # 8. Standard scaling
    # Standard scale only the original numerical features that were fitted.
    scaler_features = scaler.feature_names_in_ if hasattr(scaler, 'feature_names_in_') else [c for c in num_cols if c in df_enc.columns]

    valid_scaler_features = [c for c in scaler_features if c in df_enc.columns]
    if valid_scaler_features:
        df_enc[valid_scaler_features] = scaler.transform(df_enc[valid_scaler_features])

    return df_enc

def run_inference(input_data):
    """
    Primary function to perform inference on new data.

    Args:
        input_data (dict, list of dicts, or pd.DataFrame): The raw input transaction(s).

    Returns:
        dict: Predictions with probabilities and labels
    """
    if isinstance(input_data, dict):
        df = pd.DataFrame([input_data])
    elif isinstance(input_data, list):
        df = pd.DataFrame(input_data)
    elif isinstance(input_data, pd.DataFrame):
        df = input_data.copy()
    else:
        raise TypeError("input_data must be a dictionary, list of dictionaries, or pandas DataFrame.")

    # Load resources
    model, num_imputer, cat_imputer, scaler, train_columns = load_artifacts()

    # Preprocess
    X_processed = preprocess_data(df, num_imputer, cat_imputer, scaler, train_columns)

    # Predict (get class labels and probabilities)
    predictions = model.predict(X_processed)
    probabilities = model.predict_proba(X_processed)

    return predictions, probabilities

def predict(input_data):
    """
    Wrapper function for API compatibility.
    Converts inference results into API-friendly format.
    
    Args:
        input_data (dict): Single transaction/order data
        
    Returns:
        dict: Formatted prediction result
    """
    try:
        predictions, probabilities = run_inference(input_data)
        
        pred_class = int(predictions[0])
        fraud_probability = float(probabilities[0][1])
        
        return {
            "success": True,
            "prediction": {
                "is_fraud": bool(pred_class),
                "fraud_probability": fraud_probability,
                "label": "FRAUD" if pred_class == 1 else "LEGITIMATE",
                "confidence": max(probabilities[0]),
                "timestamp": pd.Timestamp.now().isoformat()
            },
            "input_received": input_data
        }
        
    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "details": "Model artifacts not found. Please ensure all .joblib files are in the python/ directory.",
            "input_received": input_data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "input_received": input_data
        }

def batch_predict(input_list):
    """
    Process multiple transactions at once.
    
    Args:
        input_list (list): List of transaction/order dictionaries
        
    Returns:
        list: List of prediction results
    """
    results = []
    for item in input_list:
        result = predict(item)
        results.append(result)
    return results

if __name__ == "__main__":
    # Test the module locally
    # This will fail if artifacts are not present, which is expected in production
    try:
        test_data = {
            "customer_age": 34,
            "order_total": 45.99,
            "customer_state": "CA",
            "shipping_state": "CA",
            "order_hour": 14
        }
        result = predict(test_data)
        print(json.dumps(result, indent=2))
    except FileNotFoundError as e:
        print(f"Note: {e}")
