import Link from "next/link";
import { getCustomerById, getCustomerDashboard } from "../../../lib/queries";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export default function CustomerDashboardPage({ params }) {
  const customerId = Number(params.id);
  const customer = getCustomerById(customerId);

  if (!customer) {
    return (
      <main>
        <h1>Customer Not Found</h1>
        <p>The selected customer does not exist.</p>
        <Link href="/">Back to Select Customer</Link>
      </main>
    );
  }

  const dashboard = getCustomerDashboard(customerId);

  return (
    <main>
      <h1>{customer.full_name}</h1>
      <p>
        {customer.email} - {customer.city}, {customer.state}
      </p>

      <section className="stats">
        <article className="card">
          <div className="label">Total Orders</div>
          <div className="value">{dashboard.total_orders || 0}</div>
        </article>
        <article className="card">
          <div className="label">Lifetime Value</div>
          <div className="value">{formatCurrency(dashboard.lifetime_value)}</div>
        </article>
        <article className="card">
          <div className="label">Avg Order Value</div>
          <div className="value">{formatCurrency(dashboard.avg_order_value)}</div>
        </article>
      </section>

      <p className="api">
        <Link href={`/customer/${customerId}/new-order`}>Place New Order</Link> |{" "}
        <Link href={`/customer/${customerId}/orders`}>Order History</Link> |{" "}
        <Link href="/warehouse">Warehouse Queue</Link> | <Link href="/">Select Customer</Link>
      </p>

      <h2>Recent Orders</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Date</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.recent_orders.map((order) => (
            <tr key={order.order_id}>
              <td>#{order.order_id}</td>
              <td>{order.order_datetime}</td>
              <td>{formatCurrency(order.order_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
