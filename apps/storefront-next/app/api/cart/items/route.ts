import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyRequest("/store/cart/items", request, {
    method: "POST",
    body,
  });
}
