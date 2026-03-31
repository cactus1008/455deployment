import Link from "next/link";
import { getCustomerById, getCustomerOrderHistory } from "../../../../lib/queries";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export default function CustomerOrderHistoryPage({ params }) {
  const customerId = Number(params.id);
  const customer = getCustomerById(customerId);
  const orders = getCustomerOrderHistory(customerId);

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

      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Date</th>
            <th>Total</th>
            <th>Carrier</th>
            <th>Method</th>
            <th>Late?</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
