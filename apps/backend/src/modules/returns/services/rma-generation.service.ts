import { Inject, Injectable } from "@nestjs/common";
import { desc, ilike, returnRequests } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../../common/logging/context.service";
import { createLogContext } from "../../../common/logging/logging.helper";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";

@Injectable()
export class RmaGenerationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {}

  /**
   * Generate unique RMA number
   * Format: RMA-YYYYMMDD-XXXXX (e.g., RMA-20250115-00001)
   * @returns Unique RMA number
   */
  async generateRmaNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const prefix = `RMA-${dateStr}-`;

    // Get the latest RMA number for today
    const latestReturns = await this.db
      .select({ rmaNumber: returnRequests.rmaNumber })
      .from(returnRequests)
      .where(ilike(returnRequests.rmaNumber, `${prefix}%`))
      .orderBy(desc(returnRequests.createdAt))
      .limit(1);

    let sequence = 1;
    if (latestReturns.length > 0) {
      const latestNumber = latestReturns[0].rmaNumber;
      const sequenceStr = latestNumber.replace(prefix, "");
      const parsedSequence = parseInt(sequenceStr, 10);
      if (!Number.isNaN(parsedSequence)) {
        sequence = parsedSequence + 1;
      }
    }

    // Format sequence as 5-digit number
    const formattedSequence = sequence.toString().padStart(5, "0");
    const rmaNumber = `${prefix}${formattedSequence}`;

    this.logger.debug(
      createLogContext(this.contextService, "generateRmaNumber", {
        rmaNumber,
        sequence,
      }),
      "Generated RMA number",
    );

    return rmaNumber;
  }
}
