import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function GET(_request: NextRequest) {
  return proxyRequest("/store/currencies/active", _request);
}
