# Phase 4: Model Retraining Pipeline
## Automated Daily Model Updates with Supabase Data

---

## Overview

**Goal**: Build an automated daily retraining system that:
- ✅ Pulls labeled fraud data from Supabase (fraud_logs with review_status = "approved"/"rejected")
- ✅ Trains new XGBoost model weekly/daily
- ✅ Versioning for model artifacts
- ✅ Rollback capability if performance degrades
- ✅ Manual trigger option

**Architecture**:
```
Supabase fraud_logs (labeled data)
    ↓
Retraining Script (notebooks or Python)
    ↓
New XGBoost model + artifacts
    ↓
Version storage & comparison
    ↓
Auto-deploy or manual approval
    ↓
Production model updated
```

---

## Phase 4 Steps

### STEP 1: Create Model Versioning Table in Supabase

Track all model versions and their performance.

**SQL to run in Supabase**:

```sql
-- Model versions tracking table
CREATE TABLE IF NOT EXISTS model_versions (
  model_version_id BIGSERIAL PRIMARY KEY,
  version_name VARCHAR(100) NOT NULL UNIQUE,
  model_type VARCHAR(50) DEFAULT 'xgboost',
  status VARCHAR(20) DEFAULT 'staged', -- staged, production, archived
  accuracy NUMERIC(5,4),
  precision NUMERIC(5,4),
  recall NUMERIC(5,4),
  f1_score NUMERIC(5,4),
  training_samples BIGINT,
  fraud_samples BIGINT,
  trained_on_data_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  deployed_at TIMESTAMP,
  notes TEXT
);

-- Track retraining runs
CREATE TABLE IF NOT EXISTS retraining_logs (
  retraining_id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, success, failed
  model_version_id BIGINT REFERENCES model_versions(model_version_id),
  training_samples BIGINT,
  accuracy NUMERIC(5,4),
  error_message TEXT,
  logs TEXT -- detailed training logs
);

-- Create indexes
CREATE INDEX idx_model_versions_status ON model_versions(status);
CREATE INDEX idx_model_versions_created_at ON model_versions(created_at DESC);
CREATE INDEX idx_retraining_logs_status ON retraining_logs(status);
```

---

### STEP 2: Create Training Notebook

**File**: `/notebooks/train_fraud_model.ipynb`

Since you don't have the training notebook yet, here's the complete structure:

```python
# Cell 1: Imports and Setup
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import xgboost as xgb
import joblib
import os
from datetime import datetime
import json

# Cell 2: Load Data from Supabase
import os
from supabase import create_client

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Query labeled orders from fraud_logs
print("Loading training data from Supabase...")
response = supabase.table("fraud_logs") \
    .select("order_id, customer_id, is_fraud, input_features") \
    .eq("review_status", "approved") \
    .execute()

fraud_logs = response.data
print(f"Loaded {len(fraud_logs)} labeled samples")

# Convert to DataFrame
training_data = []
for log in fraud_logs:
    row = {**log['input_features'], 'is_fraud': log['is_fraud']}
    training_data.append(row)

df = pd.DataFrame(training_data)
print(f"\nDataset shape: {df.shape}")
print(f"Fraud cases: {df['is_fraud'].sum()}")
print(f"Legitimate cases: {(~df['is_fraud']).sum()}")

# Cell 3: Data Preprocessing
print("Preprocessing data...")

# Separate features and target
X = df.drop(columns=['is_fraud', 'order_id', 'customer_id'], errors='ignore')
y = df['is_fraud'].astype(int)

# Identify numeric and categorical columns
numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

print(f"Numeric features: {numeric_cols}")
print(f"Categorical features: {categorical_cols}")

# Preprocessing pipeline
numeric_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
])

categorical_transformer = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='most_frequent')),
])

preprocessor = ColumnTransformer(
    transformers=[
        ('num', numeric_transformer, numeric_cols),
        ('cat', categorical_transformer, categorical_cols)
    ])

# Apply preprocessing
X_processed = preprocessor.fit_transform(X)
X_processed = pd.DataFrame(X_processed, columns=numeric_cols + categorical_cols)

print(f"Processed data shape: {X_processed.shape}")

# Cell 4: Split Data
print("Splitting data...")

X_train, X_test, y_train, y_test = train_test_split(
    X_processed, y, 
    test_size=0.2, 
    random_state=42,
    stratify=y
)

print(f"Training set: {X_train.shape}")
print(f"Test set: {X_test.shape}")

# Cell 5: Train XGBoost Model
print("Training XGBoost model...")

model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
    scale_pos_weight=(len(y_train) - y_train.sum()) / y_train.sum(),
    eval_metric='logloss'
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=10
)

print("Training complete!")

# Cell 6: Evaluate Model
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

y_pred = model.predict(X_test)
y_pred_proba = model.predict_proba(X_test)[:, 1]

accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)

print(f"\n=== Model Performance ===")
print(f"Accuracy:  {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall:    {recall:.4f}")
print(f"F1-Score:  {f1:.4f}")

# Cell 7: Save Model Artifacts
version_name = f"xgboost_v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
model_dir = f"python/models/{version_name}"
os.makedirs(model_dir, exist_ok=True)

print(f"\nSaving model to {model_dir}...")

joblib.dump(model, f"{model_dir}/xgboost_model.joblib")
joblib.dump(X_processed.columns.tolist(), f"{model_dir}/train_columns.joblib")
joblib.dump(preprocessor.named_transformers_['num'].named_steps['imputer'], 
            f"{model_dir}/num_imputer.joblib")
joblib.dump(preprocessor.named_transformers_['cat'].named_steps['imputer'], 
            f"{model_dir}/cat_imputer.joblib")

# Save scaler
scaler = StandardScaler()
X_numeric = X_processed[numeric_cols]
scaler.fit(X_numeric)
joblib.dump(scaler, f"{model_dir}/scaler.joblib")

print(f"Model saved!")

# Cell 8: Log to Supabase
print("Logging to Supabase...")

response = supabase.table("model_versions").insert({
    "version_name": version_name,
    "model_type": "xgboost",
    "status": "staged",
    "accuracy": float(accuracy),
    "precision": float(precision),
    "recall": float(recall),
    "f1_score": float(f1),
    "training_samples": len(X_train),
    "fraud_samples": int(y_train.sum()),
    "trained_on_data_until": datetime.now().isoformat()
}).execute()

print(f"Model version logged: {version_name}")
print(f"Ready for deployment!")
```

---

### STEP 3: Create Retraining API Endpoint

**File**: `/app/api/ml/retrain/route.js`

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    // Check if retraining is already in progress
    const retrainingFlag = path.join(process.cwd(), '.retraining-in-progress');
    
    if (fs.existsSync(retrainingFlag)) {
      return NextResponse.json(
        { error: 'Retraining already in progress' },
        { status: 429 }
      );
    }

    // Create flag file
    fs.writeFileSync(retrainingFlag, new Date().toISOString());

    // Start retraining in background
    const notebookPath = path.join(process.cwd(), 'notebooks', 'train_fraud_model.ipynb');

    // Run notebook using nbconvert or papermill
    const command = `python -m nbconvert --to notebook --execute ${notebookPath}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30 * 60 * 1000, // 30 minutes timeout
      });

      // Clean up flag
      fs.unlinkSync(retrainingFlag);

      return NextResponse.json({
        success: true,
        message: 'Model retraining completed successfully',
        output: stdout,
      });
    } catch (execError) {
      fs.unlinkSync(retrainingFlag);

      return NextResponse.json(
        {
          success: false,
          error: 'Retraining failed',
          details: execError.stderr || execError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Retrain endpoint error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Retraining setup failed',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Model Retraining API',
    usage: 'POST /api/ml/retrain - Start model retraining',
    description: 'Trains new model from labeled fraud_logs data',
  });
}
```

---

### STEP 4: Create Retraining Status Dashboard

**File**: `/app/model-versions/page.js`

```javascript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ModelVersionsPage() {
  const [versions, setVersions] = useState([]);
  const [retrainingLogs, setRetrainingLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [versionsRes, logsRes] = await Promise.all([
          fetch('/api/model-versions'),
          fetch('/api/retraining-logs')
        ]);

        const versionsData = await versionsRes.json();
        const logsData = await logsRes.json();

        setVersions(versionsData.versions || []);
        setRetrainingLogs(logsData.logs || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function startRetraining() {
    setRetraining(true);
    try {
      const response = await fetch('/api/ml/retrain', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        alert('Retraining started! Check back shortly.');
        setTimeout(() => location.reload(), 5000);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to start retraining');
    } finally {
      setRetraining(false);
    }
  }

  return (
    <main>
      <h1>Model Versions & Retraining</h1>
      <Link href="/">← Back to Dashboard</Link>

      <h2>Manual Retraining</h2>
      <button 
        onClick={startRetraining} 
        disabled={retraining}
        style={{ backgroundColor: retraining ? '#ccc' : '#28a745' }}
      >
        {retraining ? 'Retraining in progress...' : 'Start Retraining Now'}
      </button>

      <h2>Model Versions</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Accuracy</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1 Score</th>
              <th>Training Samples</th>
              <th>Fraud Cases</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.map(version => (
              <tr key={version.model_version_id}>
                <td>{version.version_name}</td>
                <td>
                  <strong>{version.status}</strong>
                </td>
                <td>{(version.accuracy * 100).toFixed(2)}%</td>
                <td>{(version.precision * 100).toFixed(2)}%</td>
                <td>{(version.recall * 100).toFixed(2)}%</td>
                <td>{(version.f1_score * 100).toFixed(2)}%</td>
                <td>{version.training_samples}</td>
                <td>{version.fraud_samples}</td>
                <td>{new Date(version.created_at).toLocaleDateString()}</td>
                <td>
                  {version.status === 'staged' && (
                    <button onClick={() => deployVersion(version.model_version_id)}>
                      Deploy
                    </button>
                  )}
                  {version.status === 'production' && (
                    <span style={{ color: 'green' }}>✓ Live</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Retraining History</h2>
      {retrainingLogs.length === 0 ? (
        <p>No retraining runs yet</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Started</th>
              <th>Completed</th>
              <th>Status</th>
              <th>Model Version</th>
              <th>Samples</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {retrainingLogs.map(log => (
              <tr key={log.retraining_id}>
                <td>{new Date(log.started_at).toLocaleString()}</td>
                <td>{log.completed_at ? new Date(log.completed_at).toLocaleString() : 'In progress'}</td>
                <td>{log.status}</td>
                <td>{log.model_version_id}</td>
                <td>{log.training_samples}</td>
                <td>{log.error_message ? '❌ ' + log.error_message : '✓'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

async function deployVersion(versionId) {
  const response = await fetch(`/api/model-versions/${versionId}/deploy`, {
    method: 'POST',
  });

  if (response.ok) {
    alert('Model deployed!');
    location.reload();
  } else {
    alert('Deployment failed');
  }
}
```

---

### STEP 5: Create Model Management API Endpoints

**File**: `/app/api/model-versions/route.js`

```javascript
import { getSupabaseServerClient } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('model_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      versions: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `/app/api/retraining-logs/route.js`

```javascript
import { getSupabaseServerClient } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('retraining_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `/app/api/model-versions/[id]/deploy/route.js`

```javascript
import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import joblib from 'joblib'; // Not available in JS; requires Python

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServerClient();

    // Get model version
    const { data: version } = await supabase
      .from('model_versions')
      .select('*')
      .eq('model_version_id', id)
      .single();

    if (!version) {
      return NextResponse.json(
        { error: 'Model version not found' },
        { status: 404 }
      );
    }

    // Set all other versions to archived
    await supabase
      .from('model_versions')
      .update({ status: 'archived' })
      .neq('model_version_id', id)
      .eq('status', 'production');

    // Set this version to production
    const { error } = await supabase
      .from('model_versions')
      .update({
        status: 'production',
        deployed_at: new Date().toISOString(),
      })
      .eq('model_version_id', id);

    if (error) throw error;

    // TODO: Update actual model files used by /api/ml/predict endpoint
    // This would involve replacing python/xgboost_model.joblib with new version

    return NextResponse.json({
      success: true,
      message: `Deployed model version ${version.version_name}`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### STEP 6: Set Up Daily Automated Retraining (Vercel Cron)

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/ml/retrain",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/ml/batch-score?limit=100",
      "schedule": "0 1 * * *"
    }
  ]
}
```

This runs:
- Batch scoring at 1 AM UTC (score unscored orders)
- Model retraining at 2 AM UTC (retrain from labeled data)

---

### STEP 7: Update Requirements

**File**: `requirements.txt`

Add these:

```
numpy==1.24.3
pandas==2.0.3
scikit-learn==1.3.0
joblib==1.3.1
xgboost==2.0.3
supabase==2.0.1
python-dotenv==1.0.0
jupyter==1.0.0
nbconvert==7.8.0
papermill==2.4.0
```

---

### STEP 8: Create Model Deployment Strategy

Create a Python script: `/scripts/deploy_model.py`

```python
#!/usr/bin/env python3
"""
Deploy a staged model version to production.
Usage: python scripts/deploy_model.py <version_name>
"""

import sys
import shutil
import os
from pathlib import Path

def deploy_model(version_name):
    """Copy model artifacts from versioned folder to production."""
    
    model_dir = Path(f"python/models/{version_name}")
    prod_dir = Path("python")
    
    if not model_dir.exists():
        print(f"❌ Model version {version_name} not found in {model_dir}")
        return False
    
    # Backup current production model
    for artifact in ["xgboost_model.joblib", "train_columns.joblib", 
                     "num_imputer.joblib", "cat_imputer.joblib", "scaler.joblib"]:
        src = prod_dir / artifact
        if src.exists():
            backup = prod_dir / f"{artifact}.backup"
            shutil.copy(src, backup)
            print(f"✓ Backed up {artifact}")
    
    # Copy new model to production
    for artifact in ["xgboost_model.joblib", "train_columns.joblib",
                     "num_imputer.joblib", "cat_imputer.joblib", "scaler.joblib"]:
        src = model_dir / artifact
        dst = prod_dir / artifact
        if src.exists():
            shutil.copy(src, dst)
            print(f"✓ Deployed {artifact}")
        else:
            print(f"❌ Missing artifact: {artifact}")
            return False
    
    print(f"\n✅ Successfully deployed {version_name}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/deploy_model.py <version_name>")
        print("Example: python scripts/deploy_model.py xgboost_v20250402_020000")
        sys.exit(1)
    
    version = sys.argv[1]
    success = deploy_model(version)
    sys.exit(0 if success else 1)
```

---

## 📋 Phase 4 Implementation Checklist

- [ ] **STEP 1**: Run SQL to create `model_versions` and `retraining_logs` tables
- [ ] **STEP 2**: Create Jupyter notebook: `/notebooks/train_fraud_model.ipynb`
- [ ] **STEP 3**: Create `/app/api/ml/retrain/route.js` endpoint
- [ ] **STEP 4**: Create `/app/model-versions/page.js` dashboard
- [ ] **STEP 5**: Create model API endpoints
- [ ] **STEP 6**: Update `vercel.json` for daily cron jobs
- [ ] **STEP 7**: Update `requirements.txt` with notebook tools
- [ ] **STEP 8**: Create `/scripts/deploy_model.py` script
- [ ] **TEST**: Run manual retraining: `curl -X POST http://localhost:3000/api/ml/retrain`
- [ ] **VERIFY**: Check `model_versions` table has new entry
- [ ] **DEPLOY**: Push to Vercel
- [ ] **VERIFY**: Check Vercel cron jobs scheduled

---

## 🧪 Testing Phase 4

### Local Testing:

```bash
# 1. Ensure you have labeled data in fraud_logs
# (Run Phase 3 batch scoring first)

# 2. Install notebook dependencies
pip install -r requirements.txt

# 3. Run manual retraining via API
curl -X POST http://localhost:3000/api/ml/retrain

# 4. Check model versions page
# http://localhost:3000/model-versions

# 5. Verify new model in Supabase
# SELECT * FROM model_versions ORDER BY created_at DESC;
```

---

## 📊 Model Versioning Strategy

### Version Naming:
```
xgboost_v{YYYYMMDD}_{HHMMSS}
Example: xgboost_v20250402_020000
```

### Status Workflow:
```
Staged (newly trained)
    ↓
Review metrics (accuracy, precision, recall)
    ↓
Approve → Production (replaces old model)
    ↓
Old → Archived (kept for rollback)
```

### Deployment:
- Option A: Manual approval via `/model-versions` dashboard
- Option B: Auto-deploy if F1 score improves by >2%

---

## 🚨 Important Notes

### 1. Data Requirements
- Retraining needs **minimum 100 labeled samples** to work well
- Initially will be empty - data builds up as fraud_logs grow
- Early retrainings may not improve model much

### 2. Model Update Timing
- Daily retraining won't degrade performance if labeled data is small
- Only "approved"/"rejected" reviews are used for training
- "Pending" reviews are excluded (not confirmed yet)

### 3. File Structure
```
project/
├── python/
│   ├── xgboost_model.joblib       (production)
│   ├── models/
│   │   └── xgboost_v20250402_020000/
│   │       ├── xgboost_model.joblib
│   │       ├── train_columns.joblib
│   │       └── ...
├── notebooks/
│   └── train_fraud_model.ipynb
└── scripts/
    └── deploy_model.py
```

### 4. Monitoring
Track these metrics:
- Training time
- Number of samples used
- Model performance (accuracy, precision, recall, F1)
- Inference latency
- Fraud detection rate vs. false positives

---

## 🔄 Workflow After Phase 4

1. **Daily at 1 AM UTC**: Batch score any unscored orders
2. **Daily at 2 AM UTC**: Retrain model from labeled fraud_logs
3. **New model created** in `model_versions` table (status: "staged")
4. **You review metrics** on `/model-versions` dashboard
5. **Click "Deploy"** to make it production
6. **Production model** replaces MLpython/xgboost_model.joblib
7. **Future predictions** use new model automatically

---

## ✨ Next: Phase 5 (Future)

- Model A/B testing (serve % of traffic different models)
- Automated rollback (if accuracy drops)
- Model explainability (show why fraud flagged)
- Integration with external fraud APIs
- Custom fraud rules engine

---

## 📞 Getting Started

1. **Prerequisite**: Supabase tables from Phase 1-3 must exist
2. **Start with STEP 1**: Create versioning tables
3. **Then STEP 2**: Create training notebook
4. **Test locally** before deploying to Vercel

Questions? Check the troubleshooting section in earlier phase guides!
