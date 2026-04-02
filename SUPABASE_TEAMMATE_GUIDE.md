# Supabase Setup for Fraud Detection - Teammate Guide

## Overview

The Next.js application is ready for Supabase integration. Your teammate needs to:

1. ✅ **Create the `fraud_logs` table** (new table)
2. ⚠️ **Optional: Set up Row Level Security (RLS)** - for production
3. ✅ **Verify schema** - ensure required columns exist in `orders` and `customers`

---

## What's Already Done

✅ **In Next.js Code** (no Supabase action needed):
- API endpoints created (`/api/ml/predict-js`, `/api/ml/batch-score`)
- Query functions written (`/lib/queries.js`)
- Frontend pages ready (`/fraud-review`, customer dashboard updates)
- All database schemas referenced in code

❌ **NOT Yet Done** (Supabase action required):
- `fraud_logs` table does NOT exist yet
- RLS policies are optional but recommended for production

---

## 🎯 What Your Teammate Must Do

### TASK 1: Create `fraud_logs` Table

**Location**: Supabase Dashboard → SQL Editor

**Run this SQL**:

```sql
-- Create fraud_logs table
CREATE TABLE IF NOT EXISTS fraud_logs (
  fraud_log_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  is_fraud BOOLEAN NOT NULL,
  fraud_probability NUMERIC(5,4) NOT NULL,
  fraud_label VARCHAR(20) NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,
  input_features JSONB,
  review_status VARCHAR(50) DEFAULT 'pending',
  reviewed_by VARCHAR(255) DEFAULT NULL,
  reviewed_at TIMESTAMP DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_fraud_logs_order_id ON fraud_logs(order_id);
CREATE INDEX idx_fraud_logs_customer_id ON fraud_logs(customer_id);
CREATE INDEX idx_fraud_logs_is_fraud ON fraud_logs(is_fraud);
CREATE INDEX idx_fraud_logs_created_at ON fraud_logs(created_at DESC);
CREATE INDEX idx_fraud_logs_review_status ON fraud_logs(review_status);

-- Enable RLS (optional but recommended)
ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;
```

**What this does:**
- Creates the fraud prediction storage table
- Links orders and customers with foreign keys
- Creates indexes for fast queries
- Enables Row Level Security (optional)

**Estimated time**: 1-2 minutes

---

### TASK 2 (Optional): Set Up Row Level Security (RLS)

**Only needed for production/multi-user access**

If you want to restrict who can see which fraud records:

```sql
-- Allow everyone to view (can customize per role)
CREATE POLICY "Allow all to view fraud_logs" ON fraud_logs
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated to insert" ON fraud_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow admins to update review status
CREATE POLICY "Allow admins to update" ON fraud_logs
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

**Estimated time**: 2-3 minutes (optional)

---

### TASK 3: Verify Existing Tables

Confirm these tables already exist with the right columns:

**`orders` table** needs:
- ✅ `order_id` (BIGINT, primary key)
- ✅ `customer_id` (BIGINT, foreign key)
- ✅ `order_total` (NUMERIC)
- ✅ `order_datetime` (TIMESTAMP)

**`customers` table** needs:
- ✅ `customer_id` (BIGINT, primary key)
- ✅ `full_name` (VARCHAR)
- ✅ `email` (VARCHAR)
- ✅ `customer_state` (VARCHAR)
- ✅ `birthdate` (DATE)
- ✅ `customer_created_at` (TIMESTAMP)

**Action**: Run this verification query:

```sql
-- Should return results for all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('orders', 'customers');
```

If any columns are missing, they need to be added to the appropriate table.

---

## 📊 Table Schema Reference

### `fraud_logs` (NEW)

```
fraud_log_id         | BIGSERIAL PRIMARY KEY
order_id             | BIGINT (foreign key to orders)
customer_id          | BIGINT (foreign key to customers)
is_fraud             | BOOLEAN - whether fraud was detected
fraud_probability    | NUMERIC(5,4) - confidence score (0.0000 - 1.0000)
fraud_label          | VARCHAR - "FRAUD" or "LEGITIMATE"
confidence           | NUMERIC(3,2) - model confidence (0.00 - 1.00)
input_features       | JSONB - raw features sent to ML model (audit trail)
review_status        | VARCHAR - "pending", "approved", "rejected"
reviewed_by          | VARCHAR - username who reviewed (admin)
reviewed_at          | TIMESTAMP - when review happened
notes                | TEXT - admin notes
created_at           | TIMESTAMP - when prediction was made
updated_at           | TIMESTAMP - when record was last updated
```

### Relationships

```
fraud_logs ──┬──> orders (order_id)
             └──> customers (customer_id)
```

---

## ✅ Verification Checklist

After your teammate completes the tasks:

**They should verify:**

```sql
-- 1. Table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'fraud_logs';
-- Should return 1 row

-- 2. Columns are correct
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'fraud_logs';
-- Should return: fraud_log_id, order_id, customer_id, is_fraud, 
--               fraud_probability, fraud_label, confidence, input_features,
--               review_status, reviewed_by, reviewed_at, notes, created_at, updated_at

-- 3. Foreign keys work
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'fraud_logs' AND constraint_type = 'FOREIGN KEY';
-- Should return 2 foreign keys

-- 4. Indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'fraud_logs';
-- Should return: idx_fraud_logs_order_id, idx_fraud_logs_customer_id, etc.
```

---

## 🚨 Important Notes for Teammate

### 1. Foreign Keys Matter
- `fraud_logs` references `orders.order_id` and `customers.customer_id`
- These tables MUST exist before creating `fraud_logs`
- Delete behavior: CASCADE (deleting an order also deletes its fraud logs)

### 2. Permissions Needed
- Need permission to create tables
- Need permission to create indexes
- Need permission to create RLS policies (if doing TASK 2)

### 3. Data Type Precision
- `fraud_probability` is NUMERIC(5,4) = max 1.0000 (5 total digits, 4 after decimal)
- `confidence` is NUMERIC(3,2) = max 1.00 (3 total digits, 2 after decimal)
- These must match for the code to work correctly

### 4. JSONB for Audit Trail
- `input_features` stores the raw ML input as JSON
- Useful for debugging predictions
- Example: `{"order_total": 125.99, "customer_state": "CA", ...}`

### 5. Review Status Values
These are the valid values for `review_status`:
- `"pending"` - default, waiting for manual review
- `"approved"` - fraud is legitimate concern, order processed carefully
- `"rejected"` - false positive, order is fine

---

## 🔧 Testing Commands

After setup, your teammate can test the endpoint:

```bash
# Get pending fraud reviews (should be empty initially)
curl -X GET http://localhost:3000/api/fraud/pending-reviews

# Try batch scoring on first 10 orders
curl -X POST "http://localhost:3000/api/ml/batch-score?limit=10" \
  -H "Content-Type: application/json"

# Check fraud_logs table has data
# (In Supabase SQL Editor)
SELECT COUNT(*) FROM fraud_logs;
```

---

## 📋 Deliverables from Teammate

After they complete the setup, they should provide:

1. ✅ Confirmation that `fraud_logs` table was created
2. ✅ Output of verification queries above
3. ✅ Screenshot of table schema in Supabase dashboard
4. ✅ Test results from test commands

---

## 🆘 If Something Goes Wrong

**Problem: "Table already exists" error**
- Solution: Run `DROP TABLE IF EXISTS fraud_logs CASCADE;` first

**Problem: "Foreign key constraint fails"**
- Cause: `orders` or `customers` table doesn't exist
- Solution: Verify those tables exist first

**Problem: "Permission denied"**
- Cause: Role doesn't have CREATE TABLE permission
- Solution: Use service role key or admin credentials

**Problem: Queries return no results**
- Cause: No data in fraud_logs yet (normal)
- Solution: Run batch scoring endpoint to populate data

---

## 📞 When Ready for Implementation

Tell your teammate:

> "The Next.js application is ready. You need to:
> 1. Create the `fraud_logs` table (TASK 1 SQL)
> 2. Optionally set up RLS (TASK 2 - for production)
> 3. Verify existing `orders` and `customers` tables have required columns
> 
> After that, let me know and we can test the batch scoring endpoint."

---

## Summary

| Task | Required? | Time | Action |
|------|-----------|------|--------|
| Create `fraud_logs` table | ✅ YES | 1-2 min | Run SQL from TASK 1 |
| Set up RLS policies | ⚠️ OPTIONAL | 2-3 min | Run SQL from TASK 2 (production) |
| Verify existing tables | ✅ YES | 1 min | Run verification query |

**Total time**: 5-15 minutes depending on optional RLS setup

**Blocker?** No - the Next.js code is fully ready. Database setup is the only dependency.
