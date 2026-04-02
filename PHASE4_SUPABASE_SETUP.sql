-- Phase 4: Model Versioning and Retraining Tables
-- Run this SQL in Supabase SQL Editor

-- Create model_versions table
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

-- Create retraining_logs table
CREATE TABLE IF NOT EXISTS retraining_logs (
  retraining_id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, success, failed
  model_version_id BIGINT REFERENCES model_versions(model_version_id),
  training_samples BIGINT,
  accuracy NUMERIC(5,4),
  error_message TEXT,
  logs TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_at ON model_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_versions_version_name ON model_versions(version_name);
CREATE INDEX IF NOT EXISTS idx_retraining_logs_status ON retraining_logs(status);
CREATE INDEX IF NOT EXISTS idx_retraining_logs_created_at ON retraining_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_retraining_logs_model_version ON retraining_logs(model_version_id);

-- Enable RLS (optional)
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE retraining_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, customize per environment)
CREATE POLICY "Allow all to view model_versions" ON model_versions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all to view retraining_logs" ON retraining_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated to insert model_versions" ON model_versions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert retraining_logs" ON retraining_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update model_versions" ON model_versions
  FOR UPDATE
  WITH CHECK (true);

-- Add query function for fraud statistics (optional)
CREATE OR REPLACE FUNCTION get_fraud_statistics()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_checked', (SELECT COUNT(*) FROM fraud_logs),
    'fraud_detected', (SELECT COUNT(*) FROM fraud_logs WHERE is_fraud = true),
    'fraud_rate', ROUND(
      (SELECT COUNT(*) FILTER(WHERE is_fraud = true) FROM fraud_logs)::NUMERIC / 
      NULLIF((SELECT COUNT(*) FROM fraud_logs), 0) * 100, 2
    ),
    'pending_review', (SELECT COUNT(*) FROM fraud_logs WHERE review_status = 'pending')
  );
END;
$$ LANGUAGE plpgsql;
