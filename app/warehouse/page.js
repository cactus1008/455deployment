import Link from "next/link";
import { getLateDeliveryPriorityQueue } from "../../lib/queries";

export const dynamic = "force-dynamic";

export default async function WarehousePage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const queue = await getLateDeliveryPriorityQueue(50);
  const justScored = resolvedSearchParams.scored === "1";
  const scoreCount = resolvedSearchParams.count;

  return (
    <main>
      <h1>Late Delivery Priority Queue</h1>
      <p>Top 50 orders ranked by predicted late-delivery probability.</p>

      <p className="api">
        <Link href="/">Select Customer</Link>
      </p>

      <form method="post" action="/api/scoring/run">
        <button type="submit">Run Scoring</button>
      </form>

      {justScored && <p className="success">Scoring complete. Orders scored: {scoreCount}</p>}

      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Method</th>
            <th>Promised Days</th>
            <th>Order Total</th>
            <th>Risk Score</th>
            <th>Late Probability</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((row) => (
            <tr key={row.order_id}>
              <td>#{row.order_id}</td>
              <td>
                <Link href={`/customer/${row.customer_id}`}>{row.customer_name}</Link>
              </td>
              <td>{row.shipping_method}</td>
              <td>{row.promised_days}</td>
              <td>${row.order_total}</td>
              <td>{row.risk_score}</td>
              <td>{(row.late_probability * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
