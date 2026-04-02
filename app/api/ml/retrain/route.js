import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';

const execAsync = promisify(exec);

/**
 * POST /api/ml/retrain
 * Starts model retraining from labeled fraud_logs data
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseServerClient();
    const retrainingFlag = path.join(process.cwd(), '.retraining-in-progress');

    // Check if retraining already in progress
    if (fs.existsSync(retrainingFlag)) {
      return NextResponse.json(
        { error: 'Retraining already in progress' },
        { status: 429 }
      );
    }

    // Create progress flag
    fs.writeFileSync(retrainingFlag, new Date().toISOString());

    // Log retraining start
    const { data: retrainingLog } = await supabase
      .from('retraining_logs')
      .insert({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select();

    const retrainingId = retrainingLog?.[0]?.retraining_id;

    // Start retraining in background
    const notebookPath = path.join(
      process.cwd(),
      'notebooks',
      'train_fraud_model.ipynb'
    );

    if (!fs.existsSync(notebookPath)) {
      fs.unlinkSync(retrainingFlag);
      return NextResponse.json(
        { error: 'Training notebook not found' },
        { status: 404 }
      );
    }

    // Run notebook (requires nbconvert or papermill)
    const command = `cd ${process.cwd()} && python -m nbconvert --to notebook --execute ${notebookPath} --output ${notebookPath}`;

    // Run in background without waiting
    exec(command, async (error, stdout, stderr) => {
      try {
        if (error) {
          // Update log with error
          await supabase
            .from('retraining_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error.message || 'Unknown error',
              logs: stderr || stdout,
            })
            .eq('retraining_id', retrainingId);

          console.error('Retraining error:', error);
        } else {
          // Update log with success
          await supabase
            .from('retraining_logs')
            .update({
              status: 'success',
              completed_at: new Date().toISOString(),
              logs: stdout,
            })
            .eq('retraining_id', retrainingId);

          console.log('Retraining completed successfully');
        }
      } catch (err) {
        console.error('Error updating retraining log:', err);
      } finally {
        // Remove flag
        if (fs.existsSync(retrainingFlag)) {
          fs.unlinkSync(retrainingFlag);
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Retraining started in background',
      retraining_id: retrainingId,
      status: 'in_progress',
    });
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
