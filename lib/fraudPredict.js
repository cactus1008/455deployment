/**
 * Fraud scoring for orders. Tune weights/coefficients to match your notebook model,
 * or replace this module with a call to a Python microservice that loads your joblib model.
 *
 * Features align with fields available on `orders` + related shipment row.
 */
export function predictFraudFromFeatures({
  order_total = 0,
  order_subtotal = 0,
  shipping_fee = 0,
  promo_used = 0,
  payment_method = "card",
  shipping_method = "standard",
}) {
  const total = Number(order_total) || 0;
  const sub = Number(order_subtotal) || 0;
  const shipFee = Number(shipping_fee) || 0;
  const promo = Number(promo_used) ? 1 : 0;
  const expedited = String(shipping_method).toLowerCase() === "expedited" ? 1 : 0;
  const payCard = String(payment_method).toLowerCase() === "card" ? 1 : 0;

  // Logistic-style score — replace coefficients after exporting from sklearn/sklearn pipeline
  const z =
    -2.2 +
    0.00085 * total +
    0.00012 * sub +
    0.04 * shipFee +
    0.55 * promo +
    0.35 * expedited -
    0.15 * payCard;

  const probability = 1 / (1 + Math.exp(-z));
  const fraud = probability >= 0.5 ? 1 : 0;
  return { fraud, probability: Number(probability.toFixed(4)) };
}
