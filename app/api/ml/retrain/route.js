import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase";

/**
 * POST /api/ml/retrain
 * Retrains the XGBoost model from the orders table.
 * Called nightly by vercel.json cron at 2 AM.
 */
export async function POST() {
  const retrainingFlag = path.join(process.cwd(), ".retraining-in-progress");

  if (fs.existsSync(retrainingFlag)) {
    return NextResponse.json(
      { error: "Retraining already in progress" },
      { status: 429 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    fs.writeFileSync(retrainingFlag, new Date().toISOString());

    let retrainingId = null;
    try {
      const { data } = await supabase
        .from("retraining_logs")
        .insert({ status: "in_progress", started_at: new Date().toISOString() })
        .select();
      retrainingId = data?.[0]?.retraining_id;
    } catch {
      /* table may not exist -- not critical */
    }

    const scriptPath = path.join(process.cwd(), "python", "train_from_orders.py");
    if (!fs.existsSync(scriptPath)) {
      fs.unlinkSync(retrainingFlag);
      return NextResponse.json({ error: "Training script not found" }, { status: 404 });
    }

    const py = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
    const command = `"${py}" "${scriptPath}"`;

    exec(command, { cwd: process.cwd(), timeout: 300_000 }, async (error, stdout, stderr) => {
      try {
        const status = error ? "failed" : "success";
        const update = {
          status,
          completed_at: new Date().toISOString(),
          ...(error ? { error_message: error.message, logs: stderr || stdout } : { logs: stdout }),
        };

        if (retrainingId) {
          await supabase.from("retraining_logs").update(update).eq("retraining_id", retrainingId);
        }
        console.log(`Retraining ${status}`, error ? error.message : "");
      } catch (err) {
        console.error("Error updating retraining log:", err);
      } finally {
        if (fs.existsSync(retrainingFlag)) fs.unlinkSync(retrainingFlag);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Retraining started in background",
      retraining_id: retrainingId,
      status: "in_progress",
    });
  } catch (error) {
    if (fs.existsSync(retrainingFlag)) fs.unlinkSync(retrainingFlag);
    return NextResponse.json({ error: error.message || "Retraining setup failed" }, { status: 500 });
  }
}

/**
 * GET /api/ml/retrain
 * Returns info about retraining endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'Model Retraining API',
    usage: 'POST /api/ml/retrain - Start model retraining',
    description:
      'Trains new model from labeled fraud_logs data. Runs in background.',
    note: 'Check /api/retraining-logs for status',
  });
}
