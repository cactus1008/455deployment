import { getLateDeliveryPriorityQueue } from "../../../lib/queries";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "50");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
  return Response.json(getLateDeliveryPriorityQueue(safeLimit));
}
