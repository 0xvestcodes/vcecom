import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { addresses, and, customers, eq } from "@vcecom/db";
import { isValidStateName } from "../../common/data/indian-states";
import {
  formatPincode,
  isValidPincodeFormat,
} from "../../common/utils/pincode.utils";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get customer ID from user ID
   */
  private async getCustomerId(userId: string): Promise<string> {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    return customer.id;
  }

  /**
   * Create a new address for a customer
   */
  async create(userId: string, createDto: CreateAddressDto) {
    const customerId = await this.getCustomerId(userId);

    // Validate PIN code format
    const formattedPincode = formatPincode(createDto.pincode);
    if (!isValidPincodeFormat(formattedPincode)) {
      throw new BadRequestException(
        "Invalid PIN code format. PIN code must be exactly 6 digits",
      );
    }

    // Validate state name (optional but recommended)
    if (createDto.state && !isValidStateName(createDto.state)) {
      // Warning: State validation is lenient - we'll accept any string but log a warning
      // In production, you might want to make this stricter
    }

    // If this is set as default, unset other default addresses
    if (createDto.type === "shipping" || createDto.type === "both") {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(
          and(
            eq(addresses.customerId, customerId),
            eq(addresses.isDefault, true),
          ),
        );
    }

    // Create address
    const [newAddress] = await this.db
      .insert(addresses)
      .values({
        customerId,
        type: createDto.type || "shipping",
        street: createDto.street,
        city: createDto.city,
        state: createDto.state,
        pincode: formattedPincode,
        district: createDto.district || null,
        country: createDto.country || "India",
        isDefault: false, // New addresses are not default by default
      })
      .returning();

    return newAddress;
  }

  /**
   * Get all addresses for a customer
   */
  async findAll(userId: string) {
    const customerId = await this.getCustomerId(userId);

    const allAddresses = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.customerId, customerId));

    return allAddresses;
  }

  /**
   * Get address by ID (ensuring it belongs to the customer)
   */
  async findOne(userId: string, addressId: string) {
    const customerId = await this.getCustomerId(userId);

    const [address] = await this.db
      .select()
      .from(addresses)
      .where(
        and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)),
      )
      .limit(1);

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    return address;
  }

  /**
   * Update an address
   */
  async update(userId: string, addressId: string, updateDto: UpdateAddressDto) {
    const customerId = await this.getCustomerId(userId);

    // Check if address exists and belongs to customer
    const [existing] = await this.db
      .select()
      .from(addresses)
      .where(
        and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Address not found");
    }

    // Validate PIN code if provided
    if (updateDto.pincode) {
      const formattedPincode = formatPincode(updateDto.pincode);
      if (!isValidPincodeFormat(formattedPincode)) {
        throw new BadRequestException(
          "Invalid PIN code format. PIN code must be exactly 6 digits",
        );
      }
    }

    // Build update data
    const updateData: Partial<typeof addresses.$inferInsert> = {};
    if (updateDto.type !== undefined) updateData.type = updateDto.type;
    if (updateDto.street !== undefined) updateData.street = updateDto.street;
    if (updateDto.city !== undefined) updateData.city = updateDto.city;
    if (updateDto.state !== undefined) updateData.state = updateDto.state;
    if (updateDto.pincode !== undefined)
      updateData.pincode = formatPincode(updateDto.pincode);
    if (updateDto.district !== undefined)
      updateData.district = updateDto.district || null;
    if (updateDto.country !== undefined) updateData.country = updateDto.country;

    // Update address
    const [updated] = await this.db
      .update(addresses)
      .set(updateData)
      .where(eq(addresses.id, addressId))
      .returning();

    return updated;
  }

  /**
   * Delete an address
   */
  async remove(userId: string, addressId: string) {
    const customerId = await this.getCustomerId(userId);

    // Check if address exists and belongs to customer
    const [existing] = await this.db
      .select()
      .from(addresses)
      .where(
        and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Address not found");
    }

    // Delete address
    await this.db.delete(addresses).where(eq(addresses.id, addressId));

    return { message: "Address deleted successfully" };
  }

  /**
   * Set an address as default
   */
  async setDefault(userId: string, addressId: string) {
    const customerId = await this.getCustomerId(userId);

    // Check if address exists and belongs to customer
    const [existing] = await this.db
      .select()
      .from(addresses)
      .where(
        and(eq(addresses.id, addressId), eq(addresses.customerId, customerId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Address not found");
    }

    // Unset all other default addresses for this customer
    await this.db
      .update(addresses)
      .set({ isDefault: false })
      .where(
        and(
          eq(addresses.customerId, customerId),
          eq(addresses.isDefault, true),
        ),
      );

    // Set this address as default
    const [updated] = await this.db
      .update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, addressId))
      .returning();

    return updated;
  }

  /**
   * Create address directly by customerId (for guest checkout)
   */
  async createByCustomerId(customerId: string, createDto: CreateAddressDto) {
    // Validate PIN code format
    const formattedPincode = formatPincode(createDto.pincode);
    if (!isValidPincodeFormat(formattedPincode)) {
      throw new BadRequestException(
        "Invalid PIN code format. PIN code must be exactly 6 digits",
      );
    }

    // Validate state name (optional but recommended)
    if (createDto.state && !isValidStateName(createDto.state)) {
      // Warning: State validation is lenient - we'll accept any string but log a warning
      // In production, you might want to make this stricter
    }

    // If this is set as default, unset other default addresses
    if (createDto.type === "shipping" || createDto.type === "both") {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(
          and(
            eq(addresses.customerId, customerId),
            eq(addresses.isDefault, true),
          ),
        );
    }

    // Create address
    const [newAddress] = await this.db
      .insert(addresses)
      .values({
        customerId,
        type: createDto.type || "shipping",
        street: createDto.street,
        city: createDto.city,
        state: createDto.state,
        pincode: formattedPincode,
        district: createDto.district || null,
        country: createDto.country || "India",
        isDefault: false, // New addresses are not default by default
      })
      .returning();

    return newAddress;
  }
}
