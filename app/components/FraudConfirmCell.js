"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FraudConfirmCell({ orderId, initial }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const val =
    initial === null || initial === undefined ? "" : String(initial);

  async function onChange(e) {
    const raw = e.target.value;
    setPending(true);
    try {
      await fetch("/api/fraud/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          admin_fraud_confirmed: raw === "" ? null : Number(raw),
        }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={val}
      onChange={onChange}
      disabled={pending}
      aria-label="Admin fraud confirmation"
    >
      <option value="">Pending</option>
      <option value="0">Not fraud</option>
      <option value="1">Fraud</option>
    </select>
  );
}
