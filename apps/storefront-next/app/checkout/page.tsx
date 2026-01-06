import { CheckoutForm } from "./checkout-form";

export default function CheckoutPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <div className="max-w-2xl">
        <CheckoutForm />
      </div>
    </div>
  );
}
