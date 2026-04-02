import Link from "next/link";
import { getCustomerById, getCustomerOrderHistory } from "../../../../lib/queries";
import FraudConfirmCell from "../../../components/FraudConfirmCell";
export const dynamic = "force-dynamic";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function fraudPredictionCell(order) {
  if (order.fraud_predicted === null || order.fraud_predicted === undefined) {
    return <span className="fraud-muted">—</span>;
  }
  const label = order.fraud_predicted === 1 ? "Fraud" : "Not fraud";
  const p = order.fraud_probability;
  const title =
    p != null ? `Model-estimated P(fraud) = ${(Number(p) * 100).toFixed(1)}%` : "Model prediction";
  return (
    <span title={title} className={order.fraud_predicted === 1 ? "fraud-yes" : ""}>
      {label}
      {p != null && (
        <span className="fraud-muted"> ({(Number(p) * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}

export default async function CustomerOrderHistoryPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const fraudScored = resolvedSearchParams?.fraud_scored;
  const customerId = Number(id);
  const customer = await getCustomerById(customerId);
  const orders = await getCustomerOrderHistory(customerId);
  const fraudSchemaAvailable = orders.fraudSchemaAvailable !== false;

  if (!customer) {
    return (
      <main>
        <h1>Customer Not Found</h1>
        <Link href="/">Back to Select Customer</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Order History - {customer.full_name}</h1>
      <p className="api">
        <Link href={`/customer/${customerId}`}>Dashboard</Link> |{" "}
        <Link href={`/customer/${customerId}/new-order`}>Place New Order</Link> |{" "}
        <Link href="/">Select Customer</Link>
      </p>

      {!fraudSchemaAvailable && (
        <p className="error">
          Fraud columns are not in your database yet. Run the SQL in{" "}
          <code>supabase/migrations/20260402_orders_fraud_columns.sql</code> in the Supabase SQL
          editor, then reload this page.
        </p>
      )}

      {fraudSchemaAvailable && (
        <form method="post" action="/api/fraud/run" style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="customer_id" value={customerId} />
          <button type="submit">Run fraud scoring (this customer)</button>
        </form>
      )}

      {fraudScored != null && fraudSchemaAvailable && (
        <p className="success">Fraud model scored {fraudScored} order(s).</p>
      )}

      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Date</th>
            <th>Total</th>
            <th>Carrier</th>
            <th>Method</th>
            <th>Late?</th>
            <th>Fraud (model)</th>
            <th>Admin confirms fraud</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.order_id}>
              <td>#{order.order_id}</td>
              <td>{order.order_datetime}</td>
              <td>{formatCurrency(order.order_total)}</td>
              <td>{order.carrier || "n/a"}</td>
              <td>{order.shipping_method || "n/a"}</td>
              <td>{order.late_delivery ? "Yes" : "No"}</td>
              <td>{fraudPredictionCell(order)}</td>
              <td>
                {fraudSchemaAvailable ? (
                  <FraudConfirmCell orderId={order.order_id} initial={order.admin_fraud_confirmed} />
                ) : (
                  <span className="fraud-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
