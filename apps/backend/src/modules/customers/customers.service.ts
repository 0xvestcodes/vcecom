import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { customers, eq, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import { formatGstin, validateGstin } from "../../common/utils/gstin.utils";
import type { Database } from "../../modules/database/db";
import { DB_TOKEN } from "../database/database.module";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class CustomersService {
  constructor(
    private jwtService: JwtService,
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Register a new customer
   * Creates both user (for authentication) and customer (for profile) records
   */
  async register(registerDto: RegisterCustomerDto) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerDto.email)) {
      throw new BadRequestException("Invalid email format");
    }

    // Check if user already exists
    let existingUser: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .select()
        .from(users)
        .where(eq(users.email, registerDto.email))
        .limit(1);
      existingUser = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.register.selectExistingUser",
          error,
          { email: registerDto.email },
        ),
        "Failed to check existing user",
      );
      throw new InternalServerErrorException("Failed to check user existence");
    }

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Check if customer with phone already exists
    let existingCustomer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .select()
        .from(customers)
        .where(eq(customers.phone, registerDto.phone))
        .limit(1);
      existingCustomer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.register.selectExistingCustomer",
          error,
          { phone: registerDto.phone },
        ),
        "Failed to check existing customer",
      );
      throw new InternalServerErrorException(
        "Failed to check customer existence",
      );
    }

    if (existingCustomer) {
      throw new BadRequestException(
        "Customer with this phone number already exists",
      );
    }

    // Validate GSTIN if provided
    if (registerDto.gstin) {
      const formattedGstin = formatGstin(registerDto.gstin);
      if (!validateGstin(formattedGstin)) {
        throw new BadRequestException(
          "Invalid GSTIN. GSTIN must be a valid 15-character GST Identification Number with correct format and checksum",
        );
      }

      // Check if GSTIN already exists
      let existingGstin: typeof customers.$inferSelect | undefined;
      try {
        const gstinResult = await this.db
          .select()
          .from(customers)
          .where(eq(customers.gstin, formattedGstin))
          .limit(1);
        existingGstin = gstinResult[0];
      } catch (error) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.register.selectExistingGstin",
            error,
            { gstin: formattedGstin },
          ),
          "Failed to check existing GSTIN",
        );
        throw new InternalServerErrorException(
          "Failed to check GSTIN existence",
        );
      }

      if (existingGstin) {
        throw new BadRequestException(
          "Customer with this GSTIN already exists",
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Create user first
    let newUser: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .insert(users)
        .values({
          email: registerDto.email,
          passwordHash,
          role: "customer",
        })
        .returning();
      newUser = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.register.insertUser",
          error,
          { email: registerDto.email },
        ),
        "Failed to create user",
      );
      throw new InternalServerErrorException("Failed to create user");
    }

    if (!newUser) {
      throw new BadRequestException("Failed to create user");
    }

    // Create customer profile
    let newCustomer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .insert(customers)
        .values({
          userId: newUser.id,
          email: registerDto.email,
          phone: registerDto.phone,
          name: registerDto.name,
          gstin: registerDto.gstin ? formatGstin(registerDto.gstin) : null,
        })
        .returning();
      newCustomer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.register.insertCustomer",
          error,
          { userId: newUser.id, email: registerDto.email },
        ),
        "Failed to create customer profile",
      );
      // Rollback: delete user if customer creation fails
      try {
        await this.db.delete(users).where(eq(users.id, newUser.id));
      } catch (rollbackError) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.register.rollbackDeleteUser",
            rollbackError,
            { userId: newUser.id },
          ),
          "Failed to rollback user creation",
        );
      }
      throw new BadRequestException("Failed to create customer profile");
    }

    if (!newCustomer) {
      // Rollback: delete user if customer creation fails
      try {
        await this.db.delete(users).where(eq(users.id, newUser.id));
      } catch (rollbackError) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.register.rollbackDeleteUser",
            rollbackError,
            { userId: newUser.id },
          ),
          "Failed to rollback user creation",
        );
      }
      throw new BadRequestException("Failed to create customer profile");
    }

    // Generate tokens
    const payload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || "change-me-in-production",
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET || "change-me-refresh-in-production",
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      customer: newCustomer,
    };
  }

  /**
   * Get customer profile by user ID
   */
  @Trace({ operation: "CustomersService.getProfile" })
  async getProfile(userId: string) {
    let customer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId))
        .limit(1);
      customer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.getProfile.selectCustomer",
          error,
          { userId },
        ),
        "Failed to fetch customer profile",
      );
      throw new NotFoundException("Customer profile not found");
    }

    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    return customer;
  }

  /**
   * Update customer profile
   */
  @Trace({ operation: "CustomersService.updateProfile" })
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    // Get existing customer
    let existingCustomer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId))
        .limit(1);
      existingCustomer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.updateProfile.selectCustomer",
          error,
          { userId },
        ),
        "Failed to fetch customer profile",
      );
      throw new NotFoundException("Customer profile not found");
    }

    if (!existingCustomer) {
      throw new NotFoundException("Customer profile not found");
    }

    // Validate phone uniqueness if phone is being updated
    if (updateDto.phone && updateDto.phone !== existingCustomer.phone) {
      let existingPhone: typeof customers.$inferSelect | undefined;
      try {
        const phoneResult = await this.db
          .select()
          .from(customers)
          .where(eq(customers.phone, updateDto.phone))
          .limit(1);
        existingPhone = phoneResult[0];
      } catch (error) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.updateProfile.selectExistingPhone",
            error,
            { phone: updateDto.phone },
          ),
          "Failed to check phone uniqueness",
        );
        throw new InternalServerErrorException(
          "Failed to validate phone number",
        );
      }

      if (existingPhone) {
        throw new BadRequestException(
          "Customer with this phone number already exists",
        );
      }
    }

    // Validate GSTIN if provided
    if (updateDto.gstin !== undefined) {
      if (updateDto.gstin) {
        const formattedGstin = formatGstin(updateDto.gstin);
        if (!validateGstin(formattedGstin)) {
          throw new BadRequestException(
            "Invalid GSTIN. GSTIN must be a valid 15-character GST Identification Number with correct format and checksum",
          );
        }

        // Check if GSTIN already exists (excluding current customer)
        let existingGstin: typeof customers.$inferSelect | undefined;
        try {
          const gstinResult = await this.db
            .select()
            .from(customers)
            .where(eq(customers.gstin, formattedGstin))
            .limit(1);
          existingGstin = gstinResult[0];
        } catch (error) {
          this.logger?.error(
            createErrorContext(
              this.contextService,
              "CustomersService.updateProfile.selectExistingGstin",
              error,
              { gstin: formattedGstin },
            ),
            "Failed to check GSTIN uniqueness",
          );
          throw new InternalServerErrorException("Failed to validate GSTIN");
        }

        if (existingGstin && existingGstin.id !== existingCustomer.id) {
          throw new BadRequestException(
            "Customer with this GSTIN already exists",
          );
        }
      }
    }

    // Build update data
    const updateData: Partial<typeof customers.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.gstin !== undefined) {
      updateData.gstin = updateDto.gstin ? formatGstin(updateDto.gstin) : null;
    }

    // Update customer
    let updated: typeof customers.$inferSelect | undefined;
    try {
      const updatedResult = await this.db
        .update(customers)
        .set(updateData)
        .where(eq(customers.userId, userId))
        .returning();
      updated = updatedResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.updateProfile.updateCustomer",
          error,
          { userId, updateData },
        ),
        "Failed to update customer profile",
      );
      throw new InternalServerErrorException("Failed to update profile");
    }

    if (!updated) {
      throw new NotFoundException("Customer profile not found");
    }

    return updated;
  }

  /**
   * Change customer password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    // Get user
    let user: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      user = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.changePassword.selectUser",
          error,
          { userId },
        ),
        "Failed to fetch user",
      );
      throw new NotFoundException("User not found");
    }

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.passwordHash) {
      throw new BadRequestException("User does not have a password set");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    // Update password
    try {
      await this.db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, userId));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.changePassword.updatePassword",
          error,
          { userId },
        ),
        "Failed to update password",
      );
      throw new InternalServerErrorException("Failed to update password");
    }

    return { message: "Password changed successfully" };
  }

  /**
   * Create or get guest customer for checkout
   * Creates customer with isGuest=true if password not provided
   * Creates account (isGuest=false) if password provided
   * @param email - Customer email
   * @param name - Customer name
   * @param phone - Customer phone (optional)
   * @param password - Optional password (if provided, creates account)
   * @returns Customer record
   */
  @Trace({ operation: "CustomersService.createGuestCustomer" })
  async createGuestCustomer(
    email: string,
    name: string,
    phone?: string,
    password?: string | null,
  ) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException("Invalid email format");
    }

    // Check if customer exists by email
    let existingCustomer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .select()
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      existingCustomer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.createGuestCustomer.selectExistingCustomer",
          error,
          { email },
        ),
        "Failed to check existing customer",
      );
      throw new InternalServerErrorException(
        "Failed to check customer existence",
      );
    }

    if (existingCustomer) {
      // If customer exists and is not a guest, error
      if (!existingCustomer.isGuest) {
        throw new BadRequestException(
          "Email already registered. Please login to continue.",
        );
      }
      // If customer exists and is guest, return existing
      return existingCustomer;
    }

    // Check if user exists by email
    let existingUser: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      existingUser = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.createGuestCustomer.selectExistingUser",
          error,
          { email },
        ),
        "Failed to check existing user",
      );
      throw new InternalServerErrorException("Failed to check user existence");
    }

    if (existingUser) {
      // User exists but customer doesn't - this shouldn't happen normally
      // But handle it gracefully
      throw new BadRequestException("User with this email already exists");
    }

    // Phone is required for guest checkout (validated in DTO)
    if (!phone) {
      throw new BadRequestException("Phone is required for guest checkout");
    }
    const customerPhone = phone;

    // Check if phone already exists (only if provided)
    if (phone) {
      let existingPhone: typeof customers.$inferSelect | undefined;
      try {
        const phoneResult = await this.db
          .select()
          .from(customers)
          .where(eq(customers.phone, phone))
          .limit(1);
        existingPhone = phoneResult[0];
      } catch (error) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.createGuestCustomer.selectExistingPhone",
            error,
            { phone },
          ),
          "Failed to check phone existence",
        );
        throw new InternalServerErrorException(
          "Failed to validate phone number",
        );
      }

      if (existingPhone) {
        throw new BadRequestException(
          "Customer with this phone number already exists",
        );
      }
    }

    // Determine if creating guest or account
    const isGuest = !password;
    const emailVerified = !!password; // Verified if password provided

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Create user first
    let newUser: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .insert(users)
        .values({
          email,
          passwordHash: passwordHash || null,
          role: "customer",
        })
        .returning();
      newUser = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.createGuestCustomer.insertUser",
          error,
          { email },
        ),
        "Failed to create user",
      );
      throw new InternalServerErrorException("Failed to create user");
    }

    if (!newUser) {
      throw new BadRequestException("Failed to create user");
    }

    // Create customer profile
    let newCustomer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .insert(customers)
        .values({
          userId: newUser.id,
          email,
          phone: customerPhone,
          name,
          isGuest,
          emailVerified,
        })
        .returning();
      newCustomer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.createGuestCustomer.insertCustomer",
          error,
          { userId: newUser.id, email },
        ),
        "Failed to create customer profile",
      );
      // Rollback: delete user if customer creation fails
      try {
        await this.db.delete(users).where(eq(users.id, newUser.id));
      } catch (rollbackError) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.createGuestCustomer.rollbackDeleteUser",
            rollbackError,
            { userId: newUser.id },
          ),
          "Failed to rollback user creation",
        );
      }
      throw new BadRequestException("Failed to create customer profile");
    }

    if (!newCustomer) {
      // Rollback: delete user if customer creation fails
      try {
        await this.db.delete(users).where(eq(users.id, newUser.id));
      } catch (rollbackError) {
        this.logger?.error(
          createErrorContext(
            this.contextService,
            "CustomersService.createGuestCustomer.rollbackDeleteUser",
            rollbackError,
            { userId: newUser.id },
          ),
          "Failed to rollback user creation",
        );
      }
      throw new BadRequestException("Failed to create customer profile");
    }

    return newCustomer;
  }

  /**
   * Claim account for guest customer
   * Converts guest customer to regular account by setting password
   * @param email - Guest customer email
   * @param token - Verification token (for now, we'll skip token validation as it's optional)
   * @param newPassword - New password for the account
   * @returns Updated customer record
   */
  async claimAccount(email: string, token: string, newPassword: string) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException("Invalid email format");
    }

    // Find customer by email
    let customer: typeof customers.$inferSelect | undefined;
    try {
      const customerResult = await this.db
        .select()
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      customer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.claimAccount.selectCustomer",
          error,
          { email },
        ),
        "Failed to fetch customer",
      );
      throw new NotFoundException("Customer not found");
    }

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Check if customer is a guest
    if (!customer.isGuest) {
      throw new BadRequestException(
        "This email is already associated with an account",
      );
    }

    // Get user
    let user: typeof users.$inferSelect | undefined;
    try {
      const userResult = await this.db
        .select()
        .from(users)
        .where(eq(users.id, customer.userId))
        .limit(1);
      user = userResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.claimAccount.selectUser",
          error,
          { userId: customer.userId },
        ),
        "Failed to fetch user",
      );
      throw new NotFoundException("User not found");
    }

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // TODO: Validate token (for now, we'll skip token validation)
    // In production, you should validate the token sent to email

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user with password
    try {
      await this.db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, user.id));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.claimAccount.updateUserPassword",
          error,
          { userId: user.id },
        ),
        "Failed to update user password",
      );
      throw new InternalServerErrorException("Failed to update password");
    }

    // Update customer: set isGuest=false, emailVerified=true
    let updatedCustomer: typeof customers.$inferSelect | undefined;
    try {
      const updatedResult = await this.db
        .update(customers)
        .set({
          isGuest: false,
          emailVerified: true,
        })
        .where(eq(customers.id, customer.id))
        .returning();
      updatedCustomer = updatedResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "CustomersService.claimAccount.updateCustomer",
          error,
          { customerId: customer.id },
        ),
        "Failed to update customer",
      );
      throw new InternalServerErrorException("Failed to update customer");
    }

    if (!updatedCustomer) {
      throw new NotFoundException("Customer not found");
    }

    return updatedCustomer;
  }
}
