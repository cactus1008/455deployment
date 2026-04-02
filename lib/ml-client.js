/**
 * Frontend Client: ML Prediction API Helper - Fraud Detection
 * 
 * Usage:
 * 1. Import this utility in your React components
 * 2. Call detectFraud(orderData) to check for fraud
 * 3. Handle the response with fraud probability and risk assessment
 */

/**
 * Call the ML prediction API for fraud detection on a single transaction/order
 */
export async function detectFraud(orderData) {
  try {
    const response = await fetch("/api/ml/predict-js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fraud detection failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Alias: predictFraud (same as detectFraud)
 */
export const predictFraud = detectFraud;

/**
 * Batch fraud detection for multiple orders
 */
export async function batchDetectFraud(ordersData) {
  try {
    const response = await fetch("/api/ml/predict-js", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: ordersData }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Batch fraud detection failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Determine fraud risk level from probability score
 */
export function getFraudRiskLevel(fraudProbability) {
  if (fraudProbability < 0.3) return "LOW";
  if (fraudProbability < 0.6) return "MEDIUM";
  return "HIGH";
}

/**
 * Example React component usage:
 * 
 * import { detectFraud, getFraudRiskLevel } from '@/lib/ml-client';
 * 
 * async function handleOrderSubmit(orderData) {
 *   const result = await detectFraud({
 *     order_total: orderData.total,
 *     customer_state: orderData.custState,
 *     shipping_state: orderData.shipState,
 *     order_hour: new Date().getHours()
 *   });
 *   
 *   if (result.success) {
 *     const isFraud = result.prediction.is_fraud;
 *     const probability = result.prediction.fraud_probability;
 *     const riskLevel = getFraudRiskLevel(probability);
 *     
 *     if (isFraud) {
 *       console.warn(`HIGH FRAUD RISK: ${riskLevel} (${(probability * 100).toFixed(1)}%)`);
 *       // Block order, notify fraud team, etc.
 *     } else {
 *       console.log('Order appears legitimate');
 *       // Process order normally
 *     }
 *   }
 * }
