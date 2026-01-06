import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { MeilisearchProvider } from "../../modules/search/providers/meilisearch.provider";
import { AppConfigService } from "../config/app.config.service";

/**
 * Guard to ensure search functionality is available
 * Throws ForbiddenException with "paid feature" message if search is not configured
 */
@Injectable()
export class SearchAvailableGuard implements CanActivate {
  constructor(
    private readonly configService: AppConfigService,
    private readonly meilisearchProvider: MeilisearchProvider,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const searchConfig = this.configService.getSearchConfig();
    const meilisearchConfig = this.configService.getMeilisearchConfig();

    // Check if search is configured and available
    const isConfigured =
      !!meilisearchConfig.host && searchConfig.indexingEnabled;
    const isReady = this.meilisearchProvider.isReady();

    if (!isConfigured || !isReady) {
      throw new ForbiddenException({
        message: "Search is a paid feature",
        error: "Search functionality is not available",
        details:
          "Search functionality requires a Meilisearch instance to be configured. Please configure MEILISEARCH_HOST and enable search indexing to use this feature.",
        code: "SEARCH_NOT_AVAILABLE",
      });
    }

    return true;
  }
}
