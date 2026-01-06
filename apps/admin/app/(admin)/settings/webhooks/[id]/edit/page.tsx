import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { WebhookForm } from "@/components/webhooks/webhook-form";

export default function EditWebhookPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <AdminPageLayout
      title="Edit Webhook"
      description="Update webhook configuration"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Webhooks", href: "/settings/webhooks" },
        { label: "Edit" },
      ]}
    >
      <div className="max-w-2xl">
        <WebhookForm webhookId={params.id} />
      </div>
    </AdminPageLayout>
  );
}
