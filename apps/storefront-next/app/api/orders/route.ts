import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  const endpoint = queryString
    ? `/store/orders?${queryString}`
    : "/store/orders";

  return proxyRequest(endpoint, request);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyRequest("/store/orders", request, {
    method: "POST",
    body,
  });
}
