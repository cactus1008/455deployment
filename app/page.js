import { getDashboardStats, getRecentOrders, getTopProducts } from "../lib/queries";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export default function HomePage() {
  const stats = getDashboardStats();
  const topProducts = getTopProducts(8);
  const recentOrders = getRecentOrders(8);

  return (
    <main>
      <h1>Shop DB Starter</h1>
      <p>This starter app reads directly from your local <code>shop.db</code> file.</p>

      <section className="stats">
        <article className="card">
          <div className="label">Products</div>
          <div className="value">{stats.products}</div>
        </article>
        <article className="card">
          <div className="label">Customers</div>
          <div className="value">{stats.customers}</div>
        </article>
        <article className="card">
          <div className="label">Orders</div>
          <div className="value">{stats.orders}</div>
        </article>
        <article className="card">
          <div className="label">Revenue</div>
          <div className="value">{formatCurrency(stats.revenue)}</div>
        </article>
      </section>

      <section className="grid-two">
        <div>
          <h2>Top Products (by units sold)</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product) => (
                <tr key={product.product_id}>
                  <td>{product.product_name}</td>
                  <td>{product.category}</td>
                  <td>{product.units_sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Recent Orders</h2>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.order_id}>
                  <td>#{order.order_id}</td>
                  <td>{order.customer_name || "Unknown"}</td>
                  <td>{formatCurrency(order.order_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="api">
        API endpoints: <code>/api/stats</code>, <code>/api/products</code>, <code>/api/orders</code>
      </p>
    </main>
  );
}
