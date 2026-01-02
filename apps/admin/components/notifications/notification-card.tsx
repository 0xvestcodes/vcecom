"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationCardProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: Date | string;
    link?: string;
  };
  onMarkRead: () => void;
}

export function NotificationCard({
  notification,
  onMarkRead,
}: NotificationCardProps) {
  const getTypeIcon = (_type: string) => {
    // Icons will be added based on notification type
    return <Bell className="h-5 w-5" />;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      low_stock: "text-orange-600",
      order_created: "text-blue-600",
      refund_processed: "text-green-600",
      review_pending: "text-yellow-600",
      media_issue: "text-red-600",
      discount_drift: "text-purple-600",
    };
    return colors[type] || "text-muted-foreground";
  };

  const content = (
    <div
      className={`flex items-start gap-4 rounded-xl border-border/50 bg-card/50 p-3 transition-all duration-200 ${
        !notification.read ? "bg-muted/30 border-primary/20" : ""
      }`}
    >
      <div className={`${getTypeColor(notification.type)}`}>
        {getTypeIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-xs">{notification.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 text-xs"
              onClick={(e) => {
                e.preventDefault();
                onMarkRead();
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <a href={notification.link} className="block">
        {content}
      </a>
    );
  }

  return content;
}
