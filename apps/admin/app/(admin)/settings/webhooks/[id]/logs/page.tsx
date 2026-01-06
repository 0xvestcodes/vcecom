import { WebhookLogsPageClient } from "@/components/webhooks/webhook-logs-page-client";

export default function WebhookLogsPage({
  params,
}: {
  params: { id: string };
}) {
  return <WebhookLogsPageClient webhookId={params.id} />;
}
