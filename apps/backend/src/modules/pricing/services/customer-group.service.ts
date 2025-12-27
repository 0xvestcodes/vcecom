import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  customerGroupPriceLists,
  customerGroups,
  customers,
  desc,
  eq,
} from "@vcecom/db";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import {
  AssignPriceListToGroupDto,
  CreateCustomerGroupDto,
  CustomerGroupResponseDto,
  UpdateCustomerGroupDto,
} from "../dto/customer-group.dto";

@Injectable()
export class CustomerGroupService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Create a new customer group
   */
  async create(
    createDto: CreateCustomerGroupDto,
  ): Promise<CustomerGroupResponseDto> {
    // Check if name already exists
    const [existing] = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.name, createDto.name))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Customer group with name '${createDto.name}' already exists`,
      );
    }

    const [newGroup] = await this.db
      .insert(customerGroups)
      .values({
        name: createDto.name,
        description: createDto.description || null,
        isActive:
          createDto.isActive !== undefined ? (createDto.isActive ? 1 : 0) : 1,
      })
      .returning();

    return this.findOne(newGroup.id);
  }

  /**
   * Get all customer groups
   */
  async findAll(): Promise<CustomerGroupResponseDto[]> {
    const groups = await this.db.select().from(customerGroups);

    return Promise.all(groups.map((group) => this.enrichCustomerGroup(group)));
  }

  /**
   * Get active customer groups
   */
  async findActive(): Promise<CustomerGroupResponseDto[]> {
    const groups = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.isActive, 1));

    return Promise.all(groups.map((group) => this.enrichCustomerGroup(group)));
  }

  /**
   * Get customer group by ID
   */
  async findOne(id: string): Promise<CustomerGroupResponseDto> {
    const [group] = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.id, id))
      .limit(1);

    if (!group) {
      throw new NotFoundException(`Customer group with ID ${id} not found`);
    }

    return this.enrichCustomerGroup(group);
  }

  /**
   * Update customer group
   */
  async update(
    id: string,
    updateDto: UpdateCustomerGroupDto,
  ): Promise<CustomerGroupResponseDto> {
    const [existing] = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Customer group with ID ${id} not found`);
    }

    // Check name uniqueness if name is being updated
    if (updateDto.name && updateDto.name !== existing.name) {
      const [nameConflict] = await this.db
        .select()
        .from(customerGroups)
        .where(eq(customerGroups.name, updateDto.name))
        .limit(1);

      if (nameConflict) {
        throw new BadRequestException(
          `Customer group with name '${updateDto.name}' already exists`,
        );
      }
    }

    const updateData: Partial<typeof customerGroups.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description || null;
    if (updateDto.isActive !== undefined)
      updateData.isActive = updateDto.isActive ? 1 : 0;

    await this.db
      .update(customerGroups)
      .set(updateData)
      .where(eq(customerGroups.id, id));

    return this.findOne(id);
  }

  /**
   * Delete customer group
   */
  async remove(id: string): Promise<{ message: string }> {
    const [existing] = await this.db
      .select()
      .from(customerGroups)
      .where(eq(customerGroups.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Customer group with ID ${id} not found`);
    }

    // Check if any customers are assigned to this group
    const customersInGroup = await this.db
      .select()
      .from(customers)
      .where(eq(customers.customerGroupId, id))
      .limit(1);

    if (customersInGroup.length > 0) {
      throw new BadRequestException(
        "Cannot delete customer group with assigned customers. Please reassign customers first.",
      );
    }

    await this.db.delete(customerGroups).where(eq(customerGroups.id, id));

    return { message: "Customer group deleted successfully" };
  }

  /**
   * Assign price list to customer group
   */
  async assignPriceList(
    groupId: string,
    assignDto: AssignPriceListToGroupDto,
  ): Promise<CustomerGroupResponseDto> {
    // Validate group exists
    await this.findOne(groupId);

    // Check if price list is already assigned
    const [existing] = await this.db
      .select()
      .from(customerGroupPriceLists)
      .where(
        and(
          eq(customerGroupPriceLists.customerGroupId, groupId),
          eq(customerGroupPriceLists.priceListId, assignDto.priceListId),
        ),
      )
      .limit(1);

    if (existing) {
      // Update priority if already assigned
      await this.db
        .update(customerGroupPriceLists)
        .set({ priority: assignDto.priority || 1 })
        .where(eq(customerGroupPriceLists.id, existing.id));
    } else {
      // Create new assignment
      await this.db.insert(customerGroupPriceLists).values({
        customerGroupId: groupId,
        priceListId: assignDto.priceListId,
        priority: assignDto.priority || 1,
      });
    }

    return this.findOne(groupId);
  }

  /**
   * Remove price list from customer group
   */
  async removePriceList(
    groupId: string,
    priceListId: string,
  ): Promise<CustomerGroupResponseDto> {
    // Validate group exists
    await this.findOne(groupId);

    const [assignment] = await this.db
      .select()
      .from(customerGroupPriceLists)
      .where(
        and(
          eq(customerGroupPriceLists.customerGroupId, groupId),
          eq(customerGroupPriceLists.priceListId, priceListId),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new NotFoundException(
        `Price list ${priceListId} is not assigned to customer group ${groupId}`,
      );
    }

    await this.db
      .delete(customerGroupPriceLists)
      .where(eq(customerGroupPriceLists.id, assignment.id));

    return this.findOne(groupId);
  }

  /**
   * Get price lists for a customer group (sorted by priority)
   */
  async getPriceListsForGroup(groupId: string): Promise<
    Array<{
      priceListId: string;
      priority: number;
    }>
  > {
    const assignments = await this.db
      .select()
      .from(customerGroupPriceLists)
      .where(eq(customerGroupPriceLists.customerGroupId, groupId))
      .orderBy(desc(customerGroupPriceLists.priority));

    return assignments.map((a) => ({
      priceListId: a.priceListId,
      priority: a.priority,
    }));
  }

  /**
   * Enrich customer group with price lists
   */
  private async enrichCustomerGroup(
    group: typeof customerGroups.$inferSelect,
  ): Promise<CustomerGroupResponseDto> {
    const priceListAssignments = await this.getPriceListsForGroup(group.id);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isActive: group.isActive === 1,
      priceLists: priceListAssignments,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
