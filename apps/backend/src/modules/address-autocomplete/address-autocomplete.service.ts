import { Inject, Injectable } from "@nestjs/common";
import { and, ilike, pincodes, sql } from "@vcecom/db";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import {
  DistrictAutocompleteQueryDto,
  StateAutocompleteQueryDto,
} from "./dto/autocomplete-query.dto";
import {
  DistrictAutocompleteResponseDto,
  DistrictSuggestionDto,
  StateAutocompleteResponseDto,
  StateSuggestionDto,
} from "./dto/autocomplete-response.dto";

@Injectable()
export class AddressAutocompleteService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get state suggestions based on query
   */
  async getStateSuggestions(
    queryDto: StateAutocompleteQueryDto,
  ): Promise<StateAutocompleteResponseDto> {
    const { query, limit = 10 } = queryDto;
    const searchQuery = `%${query}%`;

    // Get distinct states matching the query with their codes and district counts
    const states = await this.db
      .select({
        state: pincodes.state,
        stateCode: pincodes.stateCode,
        districtCount: sql<number>`COUNT(DISTINCT ${pincodes.district})::int`,
      })
      .from(pincodes)
      .where(ilike(pincodes.state, searchQuery))
      .groupBy(pincodes.state, pincodes.stateCode)
      .orderBy(pincodes.state)
      .limit(limit);

    const suggestions: StateSuggestionDto[] = states.map((state) => ({
      name: state.state,
      code: state.stateCode,
      districtCount: state.districtCount,
    }));

    // Get total count for pagination info
    const [totalResult] = await this.db
      .select({
        count: sql<number>`COUNT(DISTINCT ${pincodes.state})::int`,
      })
      .from(pincodes)
      .where(ilike(pincodes.state, searchQuery));

    return {
      states: suggestions,
      total: totalResult?.count || 0,
    };
  }

  /**
   * Get district suggestions based on query and optional state filter
   */
  async getDistrictSuggestions(
    queryDto: DistrictAutocompleteQueryDto,
  ): Promise<DistrictAutocompleteResponseDto> {
    const { query, state, limit = 10 } = queryDto;
    const searchQuery = `%${query}%`;

    // Build where conditions
    const whereConditions = [ilike(pincodes.district, searchQuery)];
    if (state) {
      whereConditions.push(ilike(pincodes.state, `%${state}%`));
    }

    const districts = await this.db
      .select({
        district: pincodes.district,
        state: pincodes.state,
        stateCode: pincodes.stateCode,
        pincodeCount: sql<number>`COUNT(DISTINCT ${pincodes.pincode})::int`,
      })
      .from(pincodes)
      .where(and(...whereConditions))
      .groupBy(pincodes.district, pincodes.state, pincodes.stateCode)
      .orderBy(pincodes.district)
      .limit(limit);

    const suggestions: DistrictSuggestionDto[] = districts.map((district) => ({
      name: district.district,
      state: district.state,
      stateCode: district.stateCode,
      pincodeCount: district.pincodeCount,
    }));

    // Get total count
    const [totalResult] = await this.db
      .select({
        count: sql<number>`COUNT(DISTINCT ${pincodes.district})::int`,
      })
      .from(pincodes)
      .where(and(...whereConditions));

    return {
      districts: suggestions,
      total: totalResult?.count || 0,
    };
  }

  /**
   * Get all states (for dropdown/select lists)
   */
  async getAllStates(): Promise<StateSuggestionDto[]> {
    const states = await this.db
      .select({
        state: pincodes.state,
        stateCode: pincodes.stateCode,
        districtCount: sql<number>`COUNT(DISTINCT ${pincodes.district})::int`,
      })
      .from(pincodes)
      .groupBy(pincodes.state, pincodes.stateCode)
      .orderBy(pincodes.state);

    return states.map((state) => ({
      name: state.state,
      code: state.stateCode,
      districtCount: state.districtCount,
    }));
  }

  /**
   * Get districts for a specific state
   */
  async getDistrictsByState(state: string): Promise<DistrictSuggestionDto[]> {
    const districts = await this.db
      .select({
        district: pincodes.district,
        state: pincodes.state,
        stateCode: pincodes.stateCode,
        pincodeCount: sql<number>`COUNT(DISTINCT ${pincodes.pincode})::int`,
      })
      .from(pincodes)
      .where(ilike(pincodes.state, `%${state}%`))
      .groupBy(pincodes.district, pincodes.state, pincodes.stateCode)
      .orderBy(pincodes.district);

    return districts.map((district) => ({
      name: district.district,
      state: district.state,
      stateCode: district.stateCode,
      pincodeCount: district.pincodeCount,
    }));
  }
}
