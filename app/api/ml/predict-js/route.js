import { NextResponse } from "next/server";
import { runMlPredictAsApi } from "../../../../lib/pipelinePredict";

/**
 * Fraud prediction: uses python/ml_logic when joblib artifacts are present,
 * otherwise lib/ml-logic.js heuristics (fine for serverless without Python).
 */

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No input data provided" },
        { status: 400 }
      );
    }

    const result = runMlPredictAsApi(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("ML Prediction Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Prediction failed",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Batch prediction endpoint
 * Endpoint: POST /api/ml/batch-predict-js
 * Body: { data: [item1, item2, ...] }
 */
export async function PUT(request) {
  try {
    const body = await request.json();

    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: 'Please provide data as array in "data" field' },
        { status: 400 }
      );
    }

    const results = body.data.map((item) => runMlPredictAsApi(item));

    return NextResponse.json({
      success: true,
      count: results.length,
      predictions: results,
    });
  } catch (error) {
    console.error("Batch Prediction Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Batch prediction failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Info endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: "ML Prediction API (JavaScript)",
    endpoints: {
      POST: "/api/ml/predict-js (single prediction)",
      PUT: "/api/ml/batch-predict-js (batch prediction)"
    },
    example: {
      endpoint: "POST /api/ml/predict-js",
      body: {
        order_id: 123,
        customer_id: 45,
        shipping_method: "standard",
        order_total: 99.99,
      },
    },
  });
}
