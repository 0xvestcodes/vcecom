import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  return proxyRequest(`/store/cart/items/${id}`, request, {
    method: "PATCH",
    body,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyRequest(`/store/cart/items/${id}`, _request, {
    method: "DELETE",
  });
}
