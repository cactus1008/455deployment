import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase";
import { scoreOrderFraud } from "../../../../lib/queries";

/**
 * GET /api/ml/batch-score?limit=100
 * Scores orders that haven't been fraud-scored yet.
 * Called nightly by vercel.json cron at 1 AM.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const supabase = getSupabaseServerClient();

  const { data: unscored, error } = await supabase
    .from("orders")
    .select("order_id")
    .is("fraud_predicted", null)
    .order("order_id", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let scored = 0;
  let errors = 0;

  for (const row of unscored || []) {
    try {
      await scoreOrderFraud(row.order_id);
      scored++;
    } catch (e) {
      errors++;
      console.error(`Failed to score order ${row.order_id}:`, e?.message || e);
    }
  }

  return NextResponse.json({
    success: true,
    found: (unscored || []).length,
    scored,
    errors,
    timestamp: new Date().toISOString(),
  });
}
