import Link from "next/link";
import { getActiveProducts, getCustomerById } from "../../../../lib/queries";

export default async function NewOrderPage({ params, searchParams }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const customerId = Number(id);
  const customer = getCustomerById(customerId);
  const products = getActiveProducts(200);
  const success = resolvedSearchParams.success === "1";
  const createdOrderId = resolvedSearchParams.order_id;
  const error = resolvedSearchParams.error;

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
      <h1>Place New Order - {customer.full_name}</h1>
      <p className="api">
        <Link href={`/customer/${customerId}`}>Dashboard</Link> |{" "}
        <Link href={`/customer/${customerId}/orders`}>Order History</Link> | <Link href="/">Select Customer</Link>
      </p>

      {success && (
        <p className="success">
          Order #{createdOrderId} created successfully.
        </p>
      )}
      {error && <p className="error">Could not create order: {error}</p>}

      <form method="post" action="/api/orders/create" className="form">
        <input type="hidden" name="customer_id" value={customerId} />

        <label>
          Product
          <select name="product_id" required>
            {products.map((product) => (
              <option value={product.product_id} key={product.product_id}>
                {product.product_name} ({product.category}) - ${product.price}
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity
          <input type="number" min="1" max="10" defaultValue="1" name="quantity" required />
        </label>

        <label>
          Shipping Method
          <select name="shipping_method" defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="expedited">Expedited</option>
          </select>
        </label>

        <label>
          Payment Method
          <select name="payment_method" defaultValue="card">
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="bank">Bank</option>
          </select>
        </label>

        <label>
          Promo Code (optional)
          <input type="text" name="promo_code" placeholder="SAVE10" />
        </label>

        <button type="submit">Place Order</button>
      </form>
    </main>
  );
}
