export enum NotificationType {
  ORDER = "ORDER",
  INVENTORY = "INVENTORY",
  REVIEW = "REVIEW",
  SHIPPING = "SHIPPING",
  PAYMENT = "PAYMENT",
  SYSTEM = "SYSTEM",
  FRAUD = "FRAUD",
  SECURITY = "SECURITY",
}

export interface NotificationEventPayload {
  adminId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}
