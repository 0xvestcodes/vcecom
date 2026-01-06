import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { WebhookForm } from "@/components/webhooks/webhook-form";

export default function CreateWebhookPage() {
  return (
    <AdminPageLayout
      title="Create Webhook"
      description="Configure a new webhook endpoint"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Webhooks", href: "/settings/webhooks" },
        { label: "Create" },
      ]}
    >
      <div className="max-w-2xl">
        <WebhookForm />
      </div>
    </AdminPageLayout>
  );
}
