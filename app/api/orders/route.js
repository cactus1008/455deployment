import { getCustomerOrderHistory, getRecentOrders } from "../../../lib/queries";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerId = Number(searchParams.get("customer_id"));
  if (Number.isFinite(customerId) && customerId > 0) {
    return Response.json(await getCustomerOrderHistory(customerId));
  }

  const limit = Number(searchParams.get("limit") || "10");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 10;

  const data = await getRecentOrders(safeLimit);
  return Response.json(data);
}
