import Link from "next/link";
import { getCustomers } from "../lib/queries";

export const dynamic = "force-dynamic";

export default async function SelectCustomerPage() {
  const customers = await getCustomers(500);

  return (
    <main>
      <h1>Select Customer</h1>
      <p>Choose a customer to open their dashboard (no login required).</p>

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
