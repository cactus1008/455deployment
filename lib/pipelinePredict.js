import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { predict as predictJs } from "./ml-logic";

function projectRoot() {
  return path.join(/* turbopackIgnore: true */ process.cwd());
}

function pythonDir() {
  return path.join(projectRoot(), "python");
}

export function pipelineArtifactsPresent() {
  const dir = pythonDir();
  return ["xgboost_model.joblib", "train_columns.joblib"].every((f) =>
    fs.existsSync(path.join(dir, f))
  );
}

/**
 * Full API-shaped response (matches ml_logic.predict / predict-js).
 */
export function runMlPredictAsApi(inputData) {
  if (pipelineArtifactsPresent()) {
    const py = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
    const script = path.join(pythonDir(), "infer_json.py");
    const result = spawnSync(py, [script], {
      input: JSON.stringify(inputData ?? {}),
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env },
    });
    if (!result.error && result.status === 0 && result.stdout) {
      try {
        const text = String(result.stdout).trim();
        const line = text.split("\n").filter(Boolean).pop();
        const parsed = JSON.parse(line);
        if (parsed.success) return parsed;
        console.warn("ml_logic inference failed, using JS fallback:", parsed.error || parsed);
      } catch {
        /* fall through */
      }
    }
    if (result.stderr) {
      console.warn("python/infer_json.py:", result.stderr.trim());
    }
  }
  return predictJs(inputData);
}

/**
 * Normalized scores for orders.fraud_predicted / fraud_probability
 */
/**
 * Merge Supabase rows into one dict for python/ml_logic.preprocess_data
 * (column names aligned with training / notebook).
 */
export function buildFraudMlPayload({ order, customer, shipment }) {
  if (!order) return {};
  const c = customer || {};
  const s = shipment || {};
  return {
    ...order,
    ship_datetime: s.ship_datetime ?? null,
    carrier: s.carrier ?? null,
    shipping_method: s.shipping_method ?? null,
    distance_band: s.distance_band ?? null,
    promised_days: s.promised_days ?? null,
    actual_days: s.actual_days ?? null,
    late_delivery: s.late_delivery ?? null,
    shipment_id: s.shipment_id ?? null,
    customer_state: c.state ?? order.shipping_state ?? null,
    customer_zip: c.zip_code ?? null,
    birthdate: c.birthdate ?? null,
    customer_created_at:
      c.customer_created_at ?? c.account_created_at ?? c.signup_date ?? c.created_at ?? null,
    full_name: c.full_name ?? null,
    email: c.email ?? null,
  };
}

export function fraudScoresFromMlResult(apiResult) {
  if (!apiResult?.success || !apiResult.prediction) {
    return { fraud: 0, probability: 0 };
  }
  const p = apiResult.prediction;
  return {
    fraud: p.is_fraud ? 1 : 0,
    probability: Number(Number(p.fraud_probability).toFixed(4)),
  };
}
