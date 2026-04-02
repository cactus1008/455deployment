import { runFraudScoringForCustomer } from "../../../../lib/queries";
import { redirect } from "next/navigation";

export async function POST(request) {
  const form = await request.formData();
  const customerId = Number(form.get("customer_id"));
  const result = await runFraudScoringForCustomer(customerId);
  redirect(`/customer/${customerId}/orders?fraud_scored=${result.scored_orders}`);
}
