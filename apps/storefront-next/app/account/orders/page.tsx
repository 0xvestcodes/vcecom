import Link from "next/link";
import { getOrders } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const orders = await getOrders(page, 10).catch(() => ({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
  }));

  const ordersData = orders as {
    data: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: number;
      createdAt: string;
    }>;
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>
      {ordersData.data.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">You have no orders yet</p>
            <Button asChild>
              <Link href="/products">Start Shopping</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ordersData.data.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      Order #{order.orderNumber}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(order.total)}
                      </p>
                      <Badge>{order.status}</Badge>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/account/orders/${order.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
