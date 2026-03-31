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

export function getCustomers(limit = 200) {
  return db
    .prepare(
      `
      SELECT customer_id, full_name, email, city, state
      FROM customers
      WHERE is_active = 1
      ORDER BY full_name ASC
      LIMIT ?
      `
    )
    .all(limit);
}

export function getCustomerById(customerId) {
  return db
    .prepare(
      `
      SELECT customer_id, full_name, email, city, state, loyalty_tier, customer_segment
      FROM customers
      WHERE customer_id = ?
      `
    )
    .get(customerId);
}

export function getCustomerDashboard(customerId) {
  const summary =
    db
      .prepare(
        `
      SELECT
        COUNT(*) AS total_orders,
        ROUND(COALESCE(SUM(order_total), 0), 2) AS lifetime_value,
        ROUND(COALESCE(AVG(order_total), 0), 2) AS avg_order_value,
        MAX(order_datetime) AS last_order_datetime
      FROM orders
      WHERE customer_id = ?
      `
      )
      .get(customerId) || {};

  const recent = db
    .prepare(
      `
    SELECT order_id, order_datetime, ROUND(order_total, 2) AS order_total
    FROM orders
    WHERE customer_id = ?
    ORDER BY order_datetime DESC
    LIMIT 10
    `
    )
    .all(customerId);

  return { ...summary, recent_orders: recent };
}

export function getCustomerOrderHistory(customerId) {
  return db
    .prepare(
      `
      SELECT
        o.order_id,
        o.order_datetime,
        ROUND(o.order_subtotal, 2) AS order_subtotal,
        ROUND(o.shipping_fee, 2) AS shipping_fee,
        ROUND(o.tax_amount, 2) AS tax_amount,
        ROUND(o.order_total, 2) AS order_total,
        s.carrier,
        s.shipping_method,
        s.promised_days,
        s.actual_days,
        s.late_delivery
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.order_id
      WHERE o.customer_id = ?
      ORDER BY o.order_datetime DESC
      `
    )
    .all(customerId);
}

export function getActiveProducts(limit = 100) {
  return db
    .prepare(
      `
      SELECT product_id, product_name, category, ROUND(price, 2) AS price
      FROM products
      WHERE is_active = 1
      ORDER BY product_name ASC
      LIMIT ?
      `
    )
    .all(limit);
}

export function createOrder({
  customerId,
  productId,
  quantity,
  shippingMethod,
  paymentMethod,
  promoCode,
}) {
  const customer = db
    .prepare("SELECT * FROM customers WHERE customer_id = ?")
    .get(customerId);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const product = db
    .prepare("SELECT * FROM products WHERE product_id = ?")
    .get(productId);
  if (!product) {
    throw new Error("Product not found.");
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lineTotal = Number(product.price) * quantity;
  const shippingFee = shippingMethod === "expedited" ? 15 : 8;
  const taxAmount = Number((lineTotal * 0.07).toFixed(2));
  const orderTotal = Number((lineTotal + shippingFee + taxAmount).toFixed(2));

  const nextOrderId =
    (db.prepare("SELECT COALESCE(MAX(order_id), 0) + 1 AS id FROM orders").get()
      .id || 1);
  const nextOrderItemId =
    (db
      .prepare("SELECT COALESCE(MAX(order_item_id), 0) + 1 AS id FROM order_items")
      .get().id || 1);
  const nextShipmentId =
    (db
      .prepare("SELECT COALESCE(MAX(shipment_id), 0) + 1 AS id FROM shipments")
      .get().id || 1);

  const txn = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO orders (
        order_id, customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
        payment_method, device_type, ip_country, promo_used, promo_code,
        order_subtotal, shipping_fee, tax_amount, order_total, risk_score, is_fraud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      nextOrderId,
      customerId,
      now,
      customer.zip_code,
      customer.zip_code,
      customer.state,
      paymentMethod,
      "web",
      "US",
      promoCode ? 1 : 0,
      promoCode || null,
      lineTotal,
      shippingFee,
      taxAmount,
      orderTotal,
      0,
      0
    );

    db.prepare(
      `
      INSERT INTO order_items (
        order_item_id, order_id, product_id, quantity, unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(
      nextOrderItemId,
      nextOrderId,
      productId,
      quantity,
      Number(product.price),
      lineTotal
    );

    db.prepare(
      `
      INSERT INTO shipments (
        shipment_id, order_id, ship_datetime, carrier, shipping_method, distance_band,
        promised_days, actual_days, late_delivery
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      nextShipmentId,
      nextOrderId,
      now,
      "UPS",
      shippingMethod,
      "regional",
      shippingMethod === "expedited" ? 2 : 5,
      null,
      0
    );
  });

  txn();
  return { order_id: nextOrderId };
}

export function runLateDeliveryScoring() {
  ensureLateDeliveryScoresTable();

  const rows = db
    .prepare(
      `
      SELECT
        o.order_id,
        o.customer_id,
        c.full_name AS customer_name,
        o.order_total,
        o.risk_score,
        s.shipping_method,
        s.promised_days
      FROM orders o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN shipments s ON s.order_id = o.order_id
      `
    )
    .all();

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const upsert = db.prepare(
    `
    INSERT INTO late_delivery_scores (
      order_id, customer_id, customer_name, shipping_method, promised_days,
      order_total, risk_score, late_probability, scored_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      customer_id=excluded.customer_id,
      customer_name=excluded.customer_name,
      shipping_method=excluded.shipping_method,
      promised_days=excluded.promised_days,
      order_total=excluded.order_total,
      risk_score=excluded.risk_score,
      late_probability=excluded.late_probability,
      scored_at=excluded.scored_at
    `
  );

  const tx = db.transaction((records) => {
    for (const row of records) {
      const risk = Number(row.risk_score || 0);
      const promisedDays = Number(row.promised_days || 5);
      const methodBoost = row.shipping_method === "standard" ? 8 : 2;
      const slowPromiseBoost = promisedDays >= 5 ? 6 : 0;
      const valueBoost = Number(row.order_total || 0) > 500 ? 4 : 0;

      const score = risk * 0.6 + methodBoost + slowPromiseBoost + valueBoost;
      const probability = Math.max(0.01, Math.min(0.99, score / 100));

      upsert.run(
        row.order_id,
        row.customer_id,
        row.customer_name || "Unknown",
        row.shipping_method || "standard",
        promisedDays,
        Number(row.order_total || 0),
        risk,
        Number(probability.toFixed(4)),
        now
      );
    }
  });

  tx(rows);
  return { scored_orders: rows.length, scored_at: now };
}

function ensureLateDeliveryScoresTable() {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS late_delivery_scores (
      order_id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      customer_name TEXT,
      shipping_method TEXT,
      promised_days INTEGER,
      order_total REAL,
      risk_score REAL,
      late_probability REAL,
      scored_at TEXT
    );
    `
  );
}

export function getLateDeliveryPriorityQueue(limit = 50) {
  ensureLateDeliveryScoresTable();
  return db
    .prepare(
      `
      SELECT
        order_id,
        customer_id,
        customer_name,
        shipping_method,
        promised_days,
        ROUND(order_total, 2) AS order_total,
        ROUND(risk_score, 2) AS risk_score,
        ROUND(late_probability, 4) AS late_probability,
        scored_at
      FROM late_delivery_scores
      ORDER BY late_probability DESC, order_total DESC
      LIMIT ?
      `
    )
    .all(limit);
}
