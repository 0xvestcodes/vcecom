import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  return proxyRequest("/store/cart", request, {
    method: "PUT",
    body,
  });
}
