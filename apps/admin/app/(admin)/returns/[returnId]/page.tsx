import { ReturnDetailsPanel } from "@/components/returns/return-details-panel";

export default async function ReturnDetailsPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const { returnId } = await params;
  return <ReturnDetailsPanel returnId={returnId} />;
}
