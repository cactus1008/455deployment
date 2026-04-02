import { updateAdminFraudConfirmation } from "../../../../lib/queries";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const orderId = Number(body.order_id);
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }
    await updateAdminFraudConfirmation(orderId, body.admin_fraud_confirmed);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 400 });
  }
}
