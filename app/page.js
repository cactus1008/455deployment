import Link from "next/link";
import { getCustomers } from "../lib/queries";

export const dynamic = "force-dynamic";

export default async function SelectCustomerPage() {
  let customers = [];
  let loadError = "";

  try {
    const result = await getCustomers(500);
    customers = Array.isArray(result) ? result : [];
  } catch (error) {
    loadError = error?.message || "Failed to load customers.";
  }

  return (
    <main>
      <h1>Select Customer</h1>
      <p>Choose a customer to open their dashboard (no login required).</p>
      {loadError ? <p className="error">Customer load error: {loadError}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.customer_id}>
              <td>{customer.full_name}</td>
              <td>{customer.email}</td>
              <td>
                {customer.city}, {customer.state}
              </td>
              <td>
                <Link href={`/customer/${customer.customer_id}`}>Open Dashboard</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="api">
        Warehouse tools: <Link href="/warehouse">Late Delivery Priority Queue</Link>
      </p>
    </main>
  );
}
