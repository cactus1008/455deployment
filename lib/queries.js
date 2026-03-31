import db from "./db";

export function getDashboardStats() {
  const counts = db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM shipments) AS shipments
      `
    )
    .get();

  const totals = db
    .prepare(
      `
      SELECT
        ROUND(COALESCE(SUM(order_total), 0), 2) AS revenue,
        ROUND(COALESCE(AVG(order_total), 0), 2) AS average_order_value
      FROM orders
      `
    )
    .get();

  return { ...counts, ...totals };
}

export function getTopProducts(limit = 10) {
  const stmt = db.prepare(
    `
    SELECT
      p.product_id,
      p.product_name,
      p.category,
      ROUND(p.price, 2) AS price,
      COALESCE(SUM(oi.quantity), 0) AS units_sold
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.product_id
    GROUP BY p.product_id
    ORDER BY units_sold DESC, p.product_name ASC
    LIMIT ?
    `
  );

  return stmt.all(limit);
}

export function getRecentOrders(limit = 10) {
  const stmt = db.prepare(
    `
    SELECT
      o.order_id,
      o.order_datetime,
      ROUND(o.order_total, 2) AS order_total,
      c.full_name AS customer_name
    FROM orders o
    LEFT JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY o.order_datetime DESC
    LIMIT ?
    `
  );

  return stmt.all(limit);
}
