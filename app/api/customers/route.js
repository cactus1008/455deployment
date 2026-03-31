import { getCustomers } from "../../../lib/queries";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "200");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 2000) : 200;
  return Response.json(await getCustomers(safeLimit));
}
