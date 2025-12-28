"use client";

import { Database } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRedisHealth, useRedisKeys } from "@/hooks/admin/use-redis-health";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function RedisPageClient() {
  const { data: health, isLoading } = useRedisHealth();
  const { data: keys } = useRedisKeys();

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Redis Health"
        description="Monitor Redis connection status and metrics"
      >
        <Card>
          <CardHeader>
            <CardTitle>Redis Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </AdminPageLayout>
    );
  }

  if (!health) {
    return (
      <AdminPageLayout
        title="Redis Health"
        description="Monitor Redis connection status and metrics"
      >
        <Card>
          <CardHeader>
            <CardTitle>Redis Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">No data available</p>
              <p className="text-xs">Unable to fetch Redis health data.</p>
            </div>
          </CardContent>
        </Card>
      </AdminPageLayout>
    );
  }

  const statusColor =
    health.status === "healthy"
      ? "bg-green-500"
      : health.status === "degraded"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <AdminPageLayout
      title="Redis Health"
      description="Monitor Redis connection status and metrics"
    >
      <div className="space-y-4">
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <CardTitle className="text-sm">Redis Health</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Redis connection status and metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            {/* Connection Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Connection Status</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                  <span className="text-xs capitalize">{health.status}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Status: {health.connection.status}
                {health.connection.latency && (
                  <span className="ml-2">
                    • Latency: {health.connection.latency}ms
                  </span>
                )}
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Memory Usage</span>
                <span className="text-xs text-muted-foreground">
                  {health.memory.percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={health.memory.percentage} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {formatBytes(health.memory.used)} /{" "}
                {health.memory.total > 0
                  ? formatBytes(health.memory.total)
                  : "Unlimited"}
              </div>
            </div>

            {/* Clients */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium">Connected Clients</div>
                <div className="text-sm font-bold">
                  {health.clients.connected}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium">Blocked Clients</div>
                <div className="text-sm font-bold">
                  {health.clients.blocked}
                </div>
              </div>
            </div>

            {/* Keyspace */}
            <div>
              <div className="text-xs font-medium mb-2">Keyspace</div>
              <div className="text-sm font-bold mb-2">
                {health.keyspace.totalKeys.toLocaleString()} keys
              </div>
              {keys && Object.keys(keys).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(keys).map(([pattern, count]) => (
                    <div
                      key={pattern}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground font-mono">
                        {pattern}
                      </span>
                      <span className="font-medium">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Replication */}
            {health.replication && (
              <div>
                <div className="text-xs font-medium mb-2">Replication</div>
                <div className="text-xs text-muted-foreground">
                  Role:{" "}
                  <span className="capitalize">{health.replication.role}</span>
                  {health.replication.connectedSlaves !== undefined && (
                    <span className="ml-2">
                      • Connected Slaves: {health.replication.connectedSlaves}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground pt-4 border-t border-border/50">
              Last updated: {new Date(health.timestamp).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
}
