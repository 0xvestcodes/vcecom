import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ACCOUNT_SKELETON_KEYS = [
  "account-skeleton-0",
  "account-skeleton-1",
  "account-skeleton-2",
  "account-skeleton-3",
];

export default function AccountLoading() {
  return (
    <div className="container py-10">
      <Skeleton className="h-10 w-48 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ACCOUNT_SKELETON_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
