import { Module } from "@nestjs/common";
import { HsnCodesController } from "./hsn-codes.controller";
import { HsnManagementService } from "./services/hsn-management.service";
import { TaxAuditService } from "./services/tax-audit.service";
import { TaxCalculationService } from "./services/tax-calculation.service";
import { TaxExemptionsService } from "./services/tax-exemptions.service";
import { TaxResolutionService } from "./services/tax-resolution.service";
import { TaxRulesService } from "./services/tax-rules.service";
import { TaxAuditController } from "./tax-audit.controller";
import { TaxExemptionsController } from "./tax-exemptions.controller";
import { TaxRulesController } from "./tax-rules.controller";

@Module({
  controllers: [
    TaxRulesController,
    TaxExemptionsController,
    HsnCodesController,
    TaxAuditController,
  ],
  providers: [
    TaxRulesService,
    TaxExemptionsService,
    HsnManagementService,
    TaxResolutionService,
    TaxCalculationService,
    TaxAuditService,
  ],
  exports: [
    TaxRulesService,
    TaxExemptionsService,
    HsnManagementService,
    TaxResolutionService,
    TaxCalculationService,
    TaxAuditService,
  ],
})
export class TaxModule {}
