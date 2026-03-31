import { getDashboardStats } from "../../../lib/queries";

export async function GET() {
  const data = await getDashboardStats();
  return Response.json(data);
}
