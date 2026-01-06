import { forwardRef, Module } from "@nestjs/common";
import { AuditLogModule } from "../../common/audit/audit-log.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersModule } from "../orders/orders.module";
import { RedisStoreModule } from "../redis-store/redis-store.module";
import { AdminReturnsController } from "./admin-returns.controller";
import { ReturnsController } from "./returns.controller";
import { RefundReconciliationService } from "./services/refund-reconciliation.service";
import { ReturnEligibilityService } from "./services/return-eligibility.service";
import { ReturnManagementService } from "./services/return-management.service";
import { ReturnRequestService } from "./services/return-request.service";
import { RmaGenerationService } from "./services/rma-generation.service";

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    NotificationsModule,
    AuditLogModule,
    RedisStoreModule,
  ],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [
    ReturnRequestService,
    ReturnEligibilityService,
    ReturnManagementService,
    RmaGenerationService,
    RefundReconciliationService,
  ],
  exports: [
    ReturnRequestService,
    ReturnEligibilityService,
    ReturnManagementService,
    RmaGenerationService,
    RefundReconciliationService,
  ],
})
export class ReturnsModule {}
