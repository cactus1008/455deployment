import { getRecentOrders } from "../../../lib/queries";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "10");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 10;

  const data = getRecentOrders(safeLimit);
  return Response.json(data);
}
