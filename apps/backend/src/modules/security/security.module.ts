import { Module } from "@nestjs/common";
import { LoggerModule } from "../../common/logging/logger.module";
import { DatabaseModule } from "../database/database.module";
import { IpHeuristicService } from "./services/ip-heuristic.service";
import { IpReputationService } from "./services/ip-reputation.service";

/**
 * Security Module
 * Provides IP reputation and automation detection services
 */
@Module({
  imports: [DatabaseModule, LoggerModule],
  providers: [IpReputationService, IpHeuristicService],
  exports: [IpReputationService, IpHeuristicService],
})
export class SecurityModule {}
