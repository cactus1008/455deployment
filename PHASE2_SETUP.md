# Phase 2: ML Pipeline Integration Guide

## ✅ What's Been Created

Your Phase 2 setup includes:

```
📁 project-root/
├── 📄 requirements.txt              # Python dependencies
├── 📁 python/
│   └── 📄 ml_logic.py              # Python ML script (convert from notebook)
├── 📁 lib/
│   ├── 📄 ml-logic.js              # JavaScript ML logic (alternative)
│   └── 📄 ml-client.js             # Frontend API client
├── 📁 app/api/ml/
│   ├── 📄 predict/route.js         # Python-based API endpoint
│   └── 📄 predict-js/route.js      # JavaScript-based API endpoint
```

## 🎯 Two Integration Paths

### **Path 1: Python (Recommended if you have a trained model)**
- **File**: `/api/ml/predict/route.js` → Calls `/python/ml_logic.py`
- **Pro**: Use your exact notebook code
- **Con**: Requires Python environment on Vercel

### **Path 2: JavaScript (Recommended for Vercel Free Tier)**
- **File**: `/api/ml/predict-js/route.js` → Uses `/lib/ml-logic.js`
- **Pro**: Works on Vercel with no extra setup
- **Con**: Requires converting Python to JavaScript

---

## 🚀 Setup Instructions

### Step 1: Prepare Your ML Logic

#### Option A: Python conversion
Replace the placeholder in `/python/ml_logic.py` with your notebook logic:
```python
# ml_logic.py
import joblib
import numpy as np

model = joblib.load('model.pkl')  # Or your model file

def predict(input_data):
    """Your ML prediction function"""
    features = [input_data['feature1'], input_data['feature2']]
    prediction = model.predict([features])
    return {
        "score": float(prediction[0]),
        "probability": float(prediction[0]),
        "label": "high_risk" if prediction[0] > 0.5 else "low_risk"
    }
```

#### Option B: JavaScript conversion
Replace the placeholder in `/lib/ml-logic.js` with your logic:
```javascript
// ml-logic.js
export function predict(inputData) {
    // Convert your ML algorithm to JavaScript
    const score = calculateScore(inputData);
    return {
        success: true,
        prediction: {
            score: score,
            probability: score / 100,
            label: score > 50 ? "high_risk" : "low_risk"
        }
    };
}
```

### Step 2: Update Environment Variables

Create `.env.local` (for local development):
```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

For Vercel: Add these in **Vercel Dashboard → Settings → Environment Variables**

### Step 3: Test Locally

#### Test Python path:
```bash
node --eval "console.log('Testing Python integration')"
```

#### Test JavaScript path:
```bash
npm run dev
# Visit http://localhost:3000/api/ml/predict-js
```

### Step 4: Deploy to Vercel

```bash
git add .
git commit -m "Phase 2: Add ML pipeline integration"
git push
```

**Important**: If using Python, ensure:
1. `requirements.txt` is in project root
2. Vercel detects it automatically

---

## 📡 API Endpoints

### Single Prediction (JavaScript - Recommended)
```
POST /api/ml/predict-js
Content-Type: application/json

{
  "order_id": 123,
  "customer_id": 45,
  "shipping_method": "standard",
  "order_total": 99.99
}
```

Response:
```json
{
  "success": true,
  "prediction": {
    "score": 42.5,
    "probability": 0.425,
    "label": "low_risk",
    "confidence": 0.92,
    "timestamp": "2025-04-02T10:30:00Z"
  },
  "inputReceived": {...}
}
```

### Batch Prediction (JavaScript)
```
PUT /api/ml/predict-js
Content-Type: application/json

{
  "data": [
    { "order_id": 123, "total": 100 },
    { "order_id": 124, "total": 200 }
  ]
}
```

---

## 🔗 Integration with Existing Endpoints

### Update `/api/scoring/run/route.js` to use ML predictions:
```javascript
import { batchPredictLateDelivery } from "../../lib/ml-client";
import { getLateDeliveryPriorityQueue } from "../../lib/queries";

export async function POST() {
  try {
    // Get all pending orders
    const orders = await getPendingOrders();
    
    // Call ML prediction API
    const predictions = await batchPredictLateDelivery(orders);
    
    // Store results in Supabase
    await savePredictionsToSupabase(predictions);
    
    return { scored_orders: predictions.count };
  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
}
```

---

## 📝 Frontend Integration Example

In your React components:
```javascript
import { predictLateDeliveryRisk } from "@/lib/ml-client";

async function handleCreateOrder(orderData) {
  // Get ML prediction
  const prediction = await predictLateDeliveryRisk({
    order_total: orderData.total,
    shipping_method: orderData.method,
    customer_id: orderData.customerId
  });
  
  if (prediction.success) {
    console.log(`Risk Score: ${prediction.prediction.probability * 100}%`);
    
    // Use the risk to inform user or warehouse
    showWarning(`Order has ${prediction.prediction.label} delivery risk`);
  }
}
```

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "Python not found" on Vercel | Use Path 2 (JavaScript) instead |
| Model file too large (>50MB) | Store in Supabase Storage, download at runtime |
| API timeout | Split batch predictions into smaller groups |
| Cold start latency | Accept first call will be slow; optimize model size |

---

## ✨ Next Steps (Phase 3)

Connect this to Supabase:
1. Store predictions in `late_delivery_scores` table
2. Update warehouse queue with risk scores
3. Add monitoring/logging for model performance

---

## 📚 Files Created

- `requirements.txt` - Python dependencies
- `python/ml_logic.py` - Python ML module
- `lib/ml-logic.js` - JavaScript ML module  
- `lib/ml-client.js` - Frontend client
- `app/api/ml/predict/route.js` - Python API endpoint
- `app/api/ml/predict-js/route.js` - JavaScript API endpoint
