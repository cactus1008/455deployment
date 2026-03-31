import { runLateDeliveryScoring } from "../../../../lib/queries";
import { redirect } from "next/navigation";

export async function POST() {
  const result = runLateDeliveryScoring();
  redirect(`/warehouse?scored=1&count=${result.scored_orders}`);
}
