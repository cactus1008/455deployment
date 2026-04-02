# Phase 3: ML Integration - Supabase Storage & Monitoring
## Complete Step-by-Step Implementation Guide

---

## Overview

**Goal**: Store fraud predictions in Supabase, display risk scores on customer dashboard, and set up batch scoring.

**Architecture**:
```
ML API (/api/ml/predict-js)
    ↓
Fraud Predictions
    ↓
Supabase (fraud_logs table)
    ↓
Customer Dashboard + Manual Review UI
```

---

## Phase 3 Steps

### STEP 1: Create Supabase Table for Fraud Logs

**Goal**: Store all fraud predictions with metadata

**SQL to run in Supabase SQL Editor**:

```sql
-- Create fraud_logs table
CREATE TABLE IF NOT EXISTS fraud_logs (
  fraud_log_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  is_fraud BOOLEAN NOT NULL,
  fraud_probability NUMERIC(5,4) NOT NULL,
  fraud_label VARCHAR(20) NOT NULL, -- "FRAUD" or "LEGITIMATE"
  confidence NUMERIC(3,2) NOT NULL,
  input_features JSONB, -- Store the raw features sent to model
  review_status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, approved
  reviewed_by VARCHAR(255) DEFAULT NULL,
  reviewed_at TIMESTAMP DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX idx_fraud_logs_order_id ON fraud_logs(order_id);
CREATE INDEX idx_fraud_logs_customer_id ON fraud_logs(customer_id);
CREATE INDEX idx_fraud_logs_is_fraud ON fraud_logs(is_fraud);
CREATE INDEX idx_fraud_logs_created_at ON fraud_logs(created_at DESC);
CREATE INDEX idx_fraud_logs_review_status ON fraud_logs(review_status);

-- Enable RLS (Row Level Security) for access control
ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;
```

✅ **What this does:**
- Stores fraud prediction results
- Links to orders and customers
- Tracks review status for manual follow-up
- Stores input features for audit trail
- Optimized with indexes for fast queries

---

### STEP 2: Create Supabase Queries (Backend)

**File**: `/lib/queries.js`

**Add these functions** to your existing queries.js:

```javascript
// At the top of queries.js, add:
export async function saveFraudPrediction(fraudData) {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('fraud_logs')
    .insert([{
      order_id: fraudData.order_id,
      customer_id: fraudData.customer_id,
      is_fraud: fraudData.is_fraud,
      fraud_probability: fraudData.fraud_probability,
      fraud_label: fraudData.label,
      confidence: fraudData.confidence,
      input_features: fraudData.input_features
    }])
    .select();
  
  if (error) throw error;
  return data?.[0] || null;
}

export async function getFraudLogsByOrder(orderId) {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('fraud_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getFraudLogsByCustomer(customerId) {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('fraud_logs')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getPendingFraudReviews(limit = 50) {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('fraud_logs')
    .select(`
      fraud_log_id,
      order_id,
      customer_id,
      is_fraud,
      fraud_probability,
      fraud_label,
      customers(full_name, email),
      orders(order_total, order_datetime)
    `)
    .eq('review_status', 'pending')
    .eq('is_fraud', true)
    .order('fraud_probability', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function updateFraudReviewStatus(fraudLogId, reviewStatus, notes = null, reviewedBy = null) {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('fraud_logs')
    .update({
      review_status: reviewStatus,
      notes: notes,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('fraud_log_id', fraudLogId)
    .select();
  
  if (error) throw error;
  return data?.[0] || null;
}

export async function getFraudStats() {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .rpc('get_fraud_statistics');
  
  if (error) {
    // Fallback if RPC doesn't exist
    const logsData = await supabase.from('fraud_logs').select('*');
    const logs = logsData.data || [];
    return {
      total_checked: logs.length,
      fraud_detected: logs.filter(l => l.is_fraud).length,
      fraud_rate: logs.length ? (logs.filter(l => l.is_fraud).length / logs.length * 100).toFixed(2) : 0,
      pending_review: logs.filter(l => l.review_status === 'pending').length
    };
  }
  
  return data || {};
}
```

✅ **What this provides:**
- Save predictions to Supabase
- Query fraud logs by order/customer
- Get pending reviews for manual inspection
- Update review status
- View fraud statistics

---

### STEP 3: Create API Endpoint for Batch Fraud Scoring

**File**: `/app/api/ml/batch-score/route.js`

**Create new route.js**:

```javascript
import { getSupabaseServerClient } from "../../../lib/supabase";
import { detectFraud } from "../../../lib/ml-client";
import { saveFraudPrediction } from "../../../lib/queries";
import { NextResponse } from "next/server";

/**
 * Batch Scoring Endpoint
 * POST /api/ml/batch-score?limit=100
 * Scores all unscored orders from the database
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const supabase = getSupabaseServerClient();

    // Get orders that haven't been scored yet
    const { data: unScoredOrders, error: queryError } = await supabase
      .from("orders")
      .select(
        `
        order_id,
        customer_id,
        order_total,
        order_datetime,
        customers(
          full_name,
          email,
          customer_state,
          birthdate,
          customer_created_at
        ),
        order_items!inner(
          product_id
        )
      `
      )
      .not(
        "order_id",
        "in",
        `(SELECT order_id FROM fraud_logs)` // Get orders NOT already scored
      )
      .limit(limit);

    if (queryError) throw queryError;

    if (!unScoredOrders || unScoredOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unscored orders found",
        scored_count: 0,
      });
    }

    // Score each order
    const results = [];
    for (const order of unScoredOrders) {
      try {
        const customerData = order.customers;

        // Prepare input for ML model
        const mlInput = {
          order_id: order.order_id,
          customer_id: order.customer_id,
          order_total: order.order_total,
          order_datetime: order.order_datetime,
          customer_state: customerData?.customer_state,
          birthdate: customerData?.birthdate,
          customer_created_at: customerData?.customer_created_at,
          order_hour: order.order_datetime
            ? new Date(order.order_datetime).getHours()
            : null,
          order_dow: order.order_datetime
            ? new Date(order.order_datetime).getDay()
            : null,
        };

        // Get fraud prediction (using frontend client)
        const prediction = await detectFraud(mlInput);

        if (prediction.success) {
          // Save to fraud_logs table
          const fraudLog = await saveFraudPrediction({
            order_id: order.order_id,
            customer_id: order.customer_id,
            is_fraud: prediction.prediction.is_fraud,
            fraud_probability: prediction.prediction.fraud_probability,
            label: prediction.prediction.label,
            confidence: prediction.prediction.confidence,
            input_features: mlInput,
          });

          results.push({
            order_id: order.order_id,
            is_fraud: prediction.prediction.is_fraud,
            fraud_probability: prediction.prediction.fraud_probability,
            fraud_log_id: fraudLog.fraud_log_id,
          });
        } else {
          console.error(
            `Prediction failed for order ${order.order_id}:`,
            prediction.error
          );
        }
      } catch (orderError) {
        console.error(
          `Error scoring order ${order.order_id}:`,
          orderError.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      scored_count: results.length,
      score_details: results,
      fraud_count: results.filter((r) => r.is_fraud).length,
    });
  } catch (error) {
    console.error("Batch scoring error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Batch scoring failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Info endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: "Batch Fraud Scoring API",
    usage: "POST /api/ml/batch-score?limit=100",
    description: "Scores all unscored orders and stores results in fraud_logs",
  });
}
```

✅ **What this does:**
- Finds all orders not yet scored
- Runs fraud detection on each
- Stores results in fraud_logs table
- Can be called manually or on schedule

---

### STEP 4: Create Fraud Review Dashboard Page

**File**: `/app/fraud-review/page.js`

**Create new page for manual review**:

```javascript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function FraudReviewPage() {
  const [fraudLogs, setFraudLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    async function loadPendingReviews() {
      try {
        // This endpoint doesn't exist yet - you'll create it in STEP 5
        const response = await fetch("/api/fraud/pending-reviews");
        if (!response.ok) throw new Error("Failed to load reviews");
        const data = await response.json();
        setFraudLogs(data.fraud_logs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPendingReviews();
  }, []);

  async function handleReview(fraudLogId, action) {
    try {
      const response = await fetch(`/api/fraud/${fraudLogId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_status: action === "approve" ? "approved" : "rejected",
          notes: reviewNote,
        }),
      });

      if (!response.ok) throw new Error("Review failed");

      // Refresh list
      setFraudLogs(fraudLogs.filter((log) => log.fraud_log_id !== fraudLogId));
      setSelectedLog(null);
      setReviewNote("");
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <main>
      <h1>Fraud Review Queue</h1>
      <p>Manually review flagged transactions</p>

      <Link href="/">← Back to Dashboard</Link>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && fraudLogs.length === 0 && (
        <p className="success">No pending fraud reviews!</p>
      )}

      {!loading && fraudLogs.length > 0 && (
        <div>
          <p>
            <strong>{fraudLogs.length}</strong> orders pending fraud review
          </p>

          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Fraud Score</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {fraudLogs.map((log) => (
                <tr
                  key={log.fraud_log_id}
                  onClick={() => setSelectedLog(log)}
                  style={{
                    cursor: "pointer",
                    backgroundColor:
                      selectedLog?.fraud_log_id === log.fraud_log_id
                        ? "#f0f0f0"
                        : "",
                  }}
                >
                  <td>#{log.order_id}</td>
                  <td>{log.customer_name}</td>
                  <td>${log.order_total}</td>
                  <td>{(log.fraud_probability * 100).toFixed(1)}%</td>
                  <td>
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(log.fraud_log_id, "reject");
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(log.fraud_log_id, "approve");
                      }}
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedLog && (
            <div className="details-panel">
              <h3>Review Details</h3>
              <p>
                <strong>Order:</strong> #{selectedLog.order_id}
              </p>
              <p>
                <strong>Fraud Score:</strong>{" "}
                {(selectedLog.fraud_probability * 100).toFixed(1)}%
              </p>
              <p>
                <strong>Features:</strong>
              </p>
              <pre>
                {JSON.stringify(selectedLog.input_features, null, 2)}
              </pre>

              <textarea
                placeholder="Add review notes..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                style={{ width: "100%", height: "100px" }}
              />

              <div style={{ marginTop: "10px", gap: "10px", display: "flex" }}>
                <button
                  onClick={() => handleReview(selectedLog.fraud_log_id, "reject")}
                  className="btn-danger"
                >
                  Reject Order
                </button>
                <button
                  onClick={() => handleReview(selectedLog.fraud_log_id, "approve")}
                  className="btn-success"
                >
                  Approve Order
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

✅ **What this provides:**
- View pending fraud reviews
- See fraud scores and details
- Approve or reject orders
- Add review notes

---

### STEP 5: Create Fraud API Endpoints

**File**: `/app/api/fraud/pending-reviews/route.js`

```javascript
import { getPendingFraudReviews } from "../../../../lib/queries";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fraudLogs = await getPendingFraudReviews(100);

    return NextResponse.json({
      success: true,
      fraud_logs: fraudLogs.map((log) => ({
        fraud_log_id: log.fraud_log_id,
        order_id: log.order_id,
        customer_id: log.customer_id,
        customer_name: log.customers?.full_name || "Unknown",
        is_fraud: log.is_fraud,
        fraud_probability: log.fraud_probability,
        fraud_label: log.fraud_label,
        confidence: log.confidence,
        input_features: log.input_features,
        order_total: log.orders?.order_total,
        order_datetime: log.orders?.order_datetime,
        created_at: log.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `/app/api/fraud/[id]/review/route.js`

```javascript
import { updateFraudReviewStatus } from "../../../../../lib/queries";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedLog = await updateFraudReviewStatus(
      parseInt(id),
      body.review_status,
      body.notes,
      "admin" // TODO: Get actual user from session
    );

    return NextResponse.json({
      success: true,
      fraud_log: updatedLog,
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

### STEP 6: Add Fraud Risk to Customer Dashboard

**File**: `/app/customer/[id]/page.js`

**Modify to show fraud risk**:

```javascript
// Add this import at the top
import { getFraudLogsByCustomer } from "../../../lib/queries";

// In your CustomerDashboardPage component, add:
export default async function CustomerDashboardPage({ params }) {
  const { id } = await params;
  const customerId = Number(id);
  const customer = await getCustomerById(customerId);

  if (!customer) {
    return (
      <main>
        <h1>Customer Not Found</h1>
        <p>The selected customer does not exist.</p>
        <Link href="/">Back to Select Customer</Link>
      </main>
    );
  }

  const dashboard = await getCustomerDashboard(customerId);
  
  // ADD THIS LINE:
  const fraudLogs = await getFraudLogsByCustomer(customerId);
  const fraudRiskOrders = fraudLogs.filter(log => log.is_fraud);

  return (
    <main>
      {/* Existing content... */}
      
      {/* ADD THIS NEW SECTION: */}
      {fraudRiskOrders.length > 0 && (
        <section className="fraud-alert">
          <h3>⚠️ Fraud Alerts</h3>
          <p>
            <strong>{fraudRiskOrders.length}</strong> order(s) flagged for review
          </p>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Fraud Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fraudRiskOrders.map(log => (
                <tr key={log.fraud_log_id}>
                  <td>#{log.order_id}</td>
                  <td>{(log.fraud_probability * 100).toFixed(1)}%</td>
                  <td>{log.review_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
```

---

### STEP 7: Set Up Scheduled Batch Scoring (Optional but Recommended)

You have 2 options:

**Option A: Manual Button (Easiest)**

Add button to warehouse page:

```javascript
// In /app/warehouse/page.js, add:
export default async function WarehousePage({ searchParams }) {
  // ... existing code ...

  return (
    <main>
      <h1>Late Delivery Priority Queue</h1>
      
      <div style={{ display: "flex", gap: "10px" }}>
        <form method="post" action="/api/scoring/run">
          <button type="submit">Run Late Delivery Scoring</button>
        </form>
        
        <form method="post" action="/api/ml/batch-score?limit=100">
          <button type="submit" style={{ backgroundColor: "#ff6b6b" }}>
            Run Fraud Scoring
          </button>
        </form>
      </div>

      {/* ... rest of content ... */}
    </main>
  );
}
```

**Option B: Automated with Vercel Cron (Advanced)**

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/ml/batch-score?limit=100",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs batch scoring at 2 AM UTC daily.

---

### STEP 8: Add Fraud Stats to Main Dashboard

**File**: `/app/page.js`

```javascript
// Add import
import { getFraudStats } from "../lib/queries";

// In your SelectCustomerPage component:
export default async function SelectCustomerPage() {
  let customers = [];
  let loadError = "";
  let fraudStats = null;

  try {
    const result = await getCustomers(500);
    customers = Array.isArray(result) ? result : [];
    
    // ADD THIS:
    fraudStats = await getFraudStats();
  } catch (error) {
    loadError = error?.message || "Failed to load data.";
  }

  return (
    <main>
      <h1>Dashboard</h1>
      
      {/* ADD FRAUD STATS SECTION: */}
      {fraudStats && (
        <section className="fraud-stats" style={{ 
          backgroundColor: "#fff3cd", 
          padding: "15px", 
          borderRadius: "5px",
          marginBottom: "20px"
        }}>
          <h3>🔍 Fraud Detection Stats</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
            <div>
              <p><strong>{fraudStats.total_checked}</strong></p>
              <p>Orders Checked</p>
            </div>
            <div>
              <p><strong>{fraudStats.fraud_detected}</strong></p>
              <p>Flagged as Fraud</p>
            </div>
            <div>
              <p><strong>{fraudStats.fraud_rate}%</strong></p>
              <p>Fraud Rate</p>
            </div>
            <div>
              <p><strong>{fraudStats.pending_review}</strong></p>
              <p>Pending Review</p>
            </div>
          </div>
          <Link href="/fraud-review">View Fraud Queue →</Link>
        </section>
      )}

      {/* Existing customer table... */}
    </main>
  );
}
```

---

## 📋 Phase 3 Implementation Checklist

- [ ] **STEP 1**: Run SQL to create `fraud_logs` table in Supabase
- [ ] **STEP 2**: Add fraud query functions to `/lib/queries.js`
- [ ] **STEP 3**: Create `/app/api/ml/batch-score/route.js`
- [ ] **STEP 4**: Create `/app/fraud-review/page.js`
- [ ] **STEP 5**: Create `/app/api/fraud/` endpoints
- [ ] **STEP 6**: Update customer dashboard with fraud risk
- [ ] **STEP 7**: Set up batch scoring (manual or automated)
- [ ] **STEP 8**: Add fraud stats to main dashboard
- [ ] Test locally: `npm run dev`
- [ ] Run batch scoring: `curl -X POST http://localhost:3000/api/ml/batch-score?limit=10`
- [ ] Verify fraud_logs table has data
- [ ] Deploy to Vercel
- [ ] Add Supabase credentials in Vercel dashboard
- [ ] Test in production

---

## 🧪 Testing Phase 3

### Local Testing:

```bash
# 1. Start dev server
npm run dev

# 2. Run batch scoring on first 10 orders
curl -X POST http://localhost:3000/api/ml/batch-score?limit=10

# 3. Visit fraud review page
# http://localhost:3000/fraud-review

# 4. Check customer dashboard for fraud alerts
# http://localhost:3000/customer/1

# 5. Verify data in Supabase
# SELECT * FROM fraud_logs;
```

### Check Results:

```sql
-- In Supabase SQL Editor:
SELECT COUNT(*) as total_scored FROM fraud_logs;
SELECT COUNT(*) as fraud_flagged FROM fraud_logs WHERE is_fraud = true;
SELECT AVG(fraud_probability) as avg_fraud_score FROM fraud_logs;
```

---

## 🚀 Next: Phase 4 (Future)

After Phase 3 works:
- Real-time fraud checks on order creation
- Advanced fraud rules (blacklist, high-value orders, etc.)
- Model retraining pipeline
- Fraud prevention actions (block, require verification)
- Detailed fraud analytics dashboard
- Integration with payment processor

---

## 📝 Summary

**Phase 3 creates a complete fraud detection workflow**:

1. ✅ Database table for fraud logs
2. ✅ Batch scoring endpoint to score unscored orders
3. ✅ Manual review dashboard for flagged orders
4. ✅ Customer dashboard showing fraud risk
5. ✅ Main dashboard with fraud statistics
6. ✅ Optional automated daily scoring

**Total files to create/modify**: 7
**Estimated time**: 2-3 hours
**Difficulty**: Medium

All code is provided above. Let me know which step to start with!
