import { getSupabaseServerClient } from "./supabase";

function round2(value) {
  return Number((Number(value || 0)).toFixed(2));
}

export async function getDashboardStats() {
  const supabase = getSupabaseServerClient();

  const [productsC, customersC, ordersC, shipmentsC] = await Promise.all([
    supabase.from("products").select("product_id", { count: "exact", head: true }),
    supabase.from("customers").select("customer_id", { count: "exact", head: true }),
    supabase.from("orders").select("order_id", { count: "exact", head: true }),
    supabase.from("shipments").select("shipment_id", { count: "exact", head: true }),
  ]);

  const { data: totalsData, error: totalsErr } = await supabase
    .from("orders")
    .select("order_total");
  if (totalsErr) throw totalsErr;

  const totals = totalsData || [];
  const revenue = totals.reduce((sum, row) => sum + Number(row.order_total || 0), 0);
  const averageOrderValue = totals.length ? revenue / totals.length : 0;

  return {
    products: productsC.count || 0,
    customers: customersC.count || 0,
    orders: ordersC.count || 0,
    shipments: shipmentsC.count || 0,
    revenue: round2(revenue),
    average_order_value: round2(averageOrderValue),
  };
}

export async function getTopProducts(limit = 10) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 500);

  const [{ data: products, error: productsErr }, { data: items, error: itemsErr }] =
    await Promise.all([
      supabase
        .from("products")
        .select("product_id, product_name, category, price")
        .limit(safeLimit * 3),
      supabase.from("order_items").select("product_id, quantity"),
    ]);
  if (productsErr) throw productsErr;
  if (itemsErr) throw itemsErr;

  const unitsByProduct = new Map();
  for (const item of items || []) {
    unitsByProduct.set(
      item.product_id,
      (unitsByProduct.get(item.product_id) || 0) + Number(item.quantity || 0)
    );
  }

  return (products || [])
    .map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      price: round2(p.price),
      units_sold: unitsByProduct.get(p.product_id) || 0,
    }))
    .sort((a, b) => b.units_sold - a.units_sold || a.product_name.localeCompare(b.product_name))
    .slice(0, safeLimit);
}

export async function getRecentOrders(limit = 10) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total, customer:customers(full_name)")
    .order("order_datetime", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;

  return (data || []).map((row) => ({
    order_id: row.order_id,
    order_datetime: row.order_datetime,
    order_total: round2(row.order_total),
    customer_name: row.customer?.full_name || "Unknown",
  }));
}

export async function getCustomers(limit = 200) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 2000);
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, full_name, email, city, state")
    .eq("is_active", 1)
    .order("full_name", { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return data || [];
}

export async function getCustomerById(customerId) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, full_name, email, city, state, loyalty_tier, customer_segment")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerDashboard(customerId) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_id, order_datetime, order_total")
    .eq("customer_id", customerId)
    .order("order_datetime", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const totalOrders = rows.length;
  const lifetimeValue = rows.reduce((sum, row) => sum + Number(row.order_total || 0), 0);
  const avgOrderValue = totalOrders ? lifetimeValue / totalOrders : 0;

  return {
    total_orders: totalOrders,
    lifetime_value: round2(lifetimeValue),
    avg_order_value: round2(avgOrderValue),
    last_order_datetime: rows[0]?.order_datetime || null,
    recent_orders: rows.slice(0, 10).map((o) => ({
      order_id: o.order_id,
      order_datetime: o.order_datetime,
      order_total: round2(o.order_total),
    })),
  };
}

export async function getCustomerOrderHistory(customerId) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, order_datetime, order_subtotal, shipping_fee, tax_amount, order_total, shipment:shipments(carrier, shipping_method, promised_days, actual_days, late_delivery)"
    )
    .eq("customer_id", customerId)
    .order("order_datetime", { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({
    order_id: row.order_id,
    order_datetime: row.order_datetime,
    order_subtotal: round2(row.order_subtotal),
    shipping_fee: round2(row.shipping_fee),
    tax_amount: round2(row.tax_amount),
    order_total: round2(row.order_total),
    carrier: row.shipment?.carrier || null,
    shipping_method: row.shipment?.shipping_method || null,
    promised_days: row.shipment?.promised_days ?? null,
    actual_days: row.shipment?.actual_days ?? null,
    late_delivery: row.shipment?.late_delivery ?? 0,
  }));
}

export async function getActiveProducts(limit = 100) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await supabase
    .from("products")
    .select("product_id, product_name, category, price")
    .eq("is_active", 1)
    .order("product_name", { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, price: round2(p.price) }));
}

export async function createOrder({
  customerId,
  productId,
  quantity,
  shippingMethod,
  paymentMethod,
  promoCode,
}) {
  const supabase = getSupabaseServerClient();

  const [{ data: customer, error: customerErr }, { data: product, error: productErr }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("customer_id", customerId).maybeSingle(),
      supabase.from("products").select("*").eq("product_id", productId).maybeSingle(),
    ]);
  if (customerErr) throw customerErr;
  if (productErr) throw productErr;

  if (!customer) {
    throw new Error("Customer not found.");
  }
  if (!product) {
    throw new Error("Product not found.");
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lineTotal = Number(product.price) * quantity;
  const shippingFee = shippingMethod === "expedited" ? 15 : 8;
  const taxAmount = Number((lineTotal * 0.07).toFixed(2));
  const orderTotal = Number((lineTotal + shippingFee + taxAmount).toFixed(2));

  const { data: createdOrder, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      order_datetime: now,
      billing_zip: customer.zip_code,
      shipping_zip: customer.zip_code,
      shipping_state: customer.state,
      payment_method: paymentMethod,
      device_type: "web",
      ip_country: "US",
      promo_used: promoCode ? 1 : 0,
      promo_code: promoCode || null,
      order_subtotal: lineTotal,
      shipping_fee: shippingFee,
      tax_amount: taxAmount,
      order_total: orderTotal,
      risk_score: 0,
      is_fraud: 0,
    })
    .select("order_id")
    .single();
  if (orderErr) throw orderErr;

  const orderId = createdOrder.order_id;
  const { error: itemErr } = await supabase.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    quantity,
    unit_price: Number(product.price),
    line_total: lineTotal,
  });
  if (itemErr) throw itemErr;

  const { error: shipmentErr } = await supabase.from("shipments").insert({
    order_id: orderId,
    ship_datetime: now,
    carrier: "UPS",
    shipping_method: shippingMethod,
    distance_band: "regional",
    promised_days: shippingMethod === "expedited" ? 2 : 5,
    actual_days: null,
    late_delivery: 0,
  });
  if (shipmentErr) throw shipmentErr;

  return { order_id: orderId };
}

export async function runLateDeliveryScoring() {
  const supabase = getSupabaseServerClient();

  const { data: rows, error } = await supabase
    .from("orders")
    .select(
      "order_id, customer_id, order_total, risk_score, customer:customers(full_name), shipment:shipments(shipping_method, promised_days)"
    );
  if (error) throw error;

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  const scoreRows = (rows || []).map((row) => {
    const risk = Number(row.risk_score || 0);
    const promisedDays = Number(row.shipment?.promised_days || 5);
    const shippingMethod = row.shipment?.shipping_method || "standard";
    const methodBoost = shippingMethod === "standard" ? 8 : 2;
    const slowPromiseBoost = promisedDays >= 5 ? 6 : 0;
    const valueBoost = Number(row.order_total || 0) > 500 ? 4 : 0;
    const score = risk * 0.6 + methodBoost + slowPromiseBoost + valueBoost;
    const probability = Math.max(0.01, Math.min(0.99, score / 100));

    return {
      order_id: row.order_id,
      customer_id: row.customer_id,
      customer_name: row.customer?.full_name || "Unknown",
      shipping_method: shippingMethod,
      promised_days: promisedDays,
      order_total: Number(row.order_total || 0),
      risk_score: risk,
      late_probability: Number(probability.toFixed(4)),
      scored_at: now,
    };
  });

  const { error: upsertErr } = await supabase
    .from("late_delivery_scores")
    .upsert(scoreRows, { onConflict: "order_id" });
  if (upsertErr) throw upsertErr;

  return { scored_orders: scoreRows.length, scored_at: now };
}

export async function getLateDeliveryPriorityQueue(limit = 50) {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await supabase
    .from("late_delivery_scores")
    .select(
      "order_id, customer_id, customer_name, shipping_method, promised_days, order_total, risk_score, late_probability, scored_at"
    )
    .order("late_probability", { ascending: false })
    .order("order_total", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    order_total: round2(row.order_total),
    risk_score: round2(row.risk_score),
  }));
}
