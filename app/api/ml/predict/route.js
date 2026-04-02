import { NextResponse } from "next/server";
import { runMlPredictAsApi } from "../../../../lib/pipelinePredict";

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "No input data provided" }, { status: 400 });
    }

    const prediction = runMlPredictAsApi(body);
    return NextResponse.json(prediction);
  } catch (error) {
    console.error("ML Prediction Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Prediction failed",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "ML Prediction API (python/ml_logic via infer_json.py when artifacts exist)",
    usage: "POST /api/ml/predict with JSON body",
    example: {
      order_total: 99.99,
      order_datetime: "2025-01-15 14:30:00",
      customer_state: "CA",
      shipping_state: "CA",
      billing_zip: "90210",
      shipping_zip: "90210",
    },
  });
}
