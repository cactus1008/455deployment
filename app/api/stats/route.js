import { getDashboardStats } from "../../../lib/queries";

export async function GET() {
  const data = getDashboardStats();
  return Response.json(data);
}
