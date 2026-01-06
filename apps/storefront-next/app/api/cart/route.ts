import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const checkoutSessionId = searchParams.get("checkoutSessionId");

  const endpoint = checkoutSessionId
    ? `/store/cart?checkoutSessionId=${checkoutSessionId}`
    : "/store/cart";

  return proxyRequest(endpoint, request);
}
