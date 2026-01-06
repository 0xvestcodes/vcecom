import { Card, CardContent } from "@/components/ui/card";
import { PaymentForm } from "./payment-form";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.sessionId;

  if (!sessionId) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Invalid checkout session</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Payment</h1>
      <div className="max-w-2xl">
        <PaymentForm sessionId={sessionId} />
      </div>
    </div>
  );
}
