/**
 * JavaScript Alternative: Fraud Detection ML Logic
 * Converting XGBoost model logic to JavaScript (fallback if Python unavailable)
 * 
 * NOTE: For full accuracy, use the Python version with actual trained model.
 * This is a simplified JavaScript simulation of the fraud detection model.
 */

/**
 * Simplified fraud detection heuristic (JavaScript version)
 * Use Python version with actual XGBoost model for production accuracy.
 */
function calculateFraudScore(inputData) {
  // Simplified heuristics when Python model unavailable
  let riskFactors = 0;
  let maxRisk = 0;

  // Check for geographic mismatch (common fraud indicator)
  if (
    inputData.customer_state &&
    inputData.shipping_state &&
    inputData.customer_state !== inputData.shipping_state
  ) {
    riskFactors += 2;
    maxRisk = Math.max(maxRisk, 0.3);
  }

  // Check for billing/shipping zip mismatch
  if (
    inputData.billing_zip &&
    inputData.shipping_zip &&
    inputData.billing_zip !== inputData.shipping_zip
  ) {
    riskFactors += 1;
    maxRisk = Math.max(maxRisk, 0.2);
  }

  // High order value risk (simplified)
  if (inputData.order_total > 500) {
    riskFactors += 0.5;
    maxRisk = Math.max(maxRisk, 0.15);
  }

  // Weekend ordering risk
  if (inputData.order_dow === 5 || inputData.order_dow === 6) {
    riskFactors += 0.3;
  }

  // Calculate fraud probability
  let fraudProbability = Math.min(maxRisk + riskFactors * 0.05, 0.95);

  return {
    score: parseFloat((fraudProbability * 100).toFixed(2)),
    probability: parseFloat(fraudProbability.toFixed(4)),
    isFraud: fraudProbability > 0.5,
  };
}

/**
 * Main prediction function (JS version)
 */
export function predict(inputData) {
  try {
    const fraudAnalysis = calculateFraudScore(inputData);

    return {
      success: true,
      prediction: {
        is_fraud: fraudAnalysis.isFraud,
        fraud_probability: fraudAnalysis.probability,
        label: fraudAnalysis.isFraud ? "FRAUD" : "LEGITIMATE",
        confidence: 0.65, // Lower confidence for JS version
        timestamp: new Date().toISOString(),
      },
      inputReceived: inputData,
      note: "Using JavaScript fallback. For accurate predictions, use Python model.",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      inputReceived: inputData,
    };
  }
}

/**
 * Batch prediction function
 */
export function batchPredict(inputList) {
  return inputList.map((item) => predict(item));
}

