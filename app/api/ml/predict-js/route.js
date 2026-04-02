import { predict, batchPredict } from "../../../lib/ml-logic";
import { NextResponse } from "next/server";

/**
 * ML Prediction API Endpoint (Pure JavaScript version)
 * Use this if Python is not available on Vercel.
 * 
 * Endpoint: POST /api/ml/predict-js
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

    // Run prediction
    const result = predict(body);

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

    const results = batchPredict(body.data);

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
