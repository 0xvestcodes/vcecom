import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { FraudBlacklistService } from "./fraud-blacklist.service";
import { FraudDetectionService } from "./fraud-detection.service";
import { FraudDuplicateDetectionService } from "./fraud-duplicate-detection.service";
import { FraudRiskScoringService } from "./fraud-risk-scoring.service";
import { FraudVelocityService } from "./fraud-velocity.service";

@Module({
  imports: [NotificationsModule],
  providers: [
    FraudDetectionService,
    FraudBlacklistService,
    FraudRiskScoringService,
    FraudDuplicateDetectionService,
    FraudVelocityService,
  ],
  exports: [
    FraudDetectionService,
    FraudBlacklistService,
    FraudRiskScoringService,
    FraudDuplicateDetectionService,
    FraudVelocityService,
  ],
})
export class FraudDetectionModule {}
