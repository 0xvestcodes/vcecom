import { NextResponse } from "next/server";

/**
 * Metrics endpoint for monitoring tools
 * Returns empty 200 response to prevent 404 errors from monitoring tools
 */
export async function GET() {
  // Return empty response - monitoring tools just need to know the endpoint exists
  // If you want to expose actual metrics, you can integrate with a metrics library
  return NextResponse.json({}, { status: 200 });
}
