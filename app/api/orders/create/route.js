import { createOrder } from "../../../../lib/queries";
import { redirect } from "next/navigation";

export async function POST(request) {
  const form = await request.formData();

  const customerId = Number(form.get("customer_id"));
  const productId = Number(form.get("product_id"));
  const quantity = Number(form.get("quantity") || 1);
  const shippingMethod = String(form.get("shipping_method") || "standard");
  const paymentMethod = String(form.get("payment_method") || "card");
  const promoCode = String(form.get("promo_code") || "").trim();

  try {
    const created = await createOrder({
      customerId,
      productId,
      quantity,
      shippingMethod,
      paymentMethod,
      promoCode,
    });
    redirect(`/customer/${customerId}/new-order?success=1&order_id=${created.order_id}`);
  } catch (error) {
    const message = encodeURIComponent(error.message || "Unknown error");
    redirect(`/customer/${customerId}/new-order?error=${message}`);
  }
}
