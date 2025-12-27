import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  addresses,
  customers,
  eq,
  orderItems,
  orders,
  shipments,
} from "@vcecom/db";
import { AppConfigService } from "../../common/config/app.config.service";
import {
  SHIPROCKET_CANCEL_SHIPMENT_ENDPOINT_TEMPLATE,
  SHIPROCKET_PICKUP_LOCATIONS_ENDPOINT,
} from "../../common/constants/shipping.constants";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { ShiprocketConfigService } from "./shiprocket-config.service";

export interface ShiprocketAuthToken {
  token: string;
  expiresAt?: number;
}

@Injectable()
export class ShiprocketService implements OnModuleInit {
  private authToken: ShiprocketAuthToken | null = null;
  private email: string | null = null;
  private password: string | null = null;
  private baseUrl: string;

  constructor(
    private readonly shiprocketConfigService: ShiprocketConfigService,
    private readonly appConfigService: AppConfigService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {
    this.baseUrl = this.shiprocketConfigService.getBaseUrl();
  }

  /**
   * Initialize Shiprocket on module initialization
   * Reads configuration from AppConfigService
   */
  onModuleInit() {
    // Note: We don't authenticate here to avoid blocking module initialization
    // Authentication will happen on first use or via manual initialization
    const config = this.appConfigService.getShiprocketConfig();

    if (config.email && config.password) {
      // Store credentials but don't authenticate yet
      this.email = config.email;
      this.password = config.password;
    }
  }

  /**
   * Initialize Shiprocket with credentials
   * @param email - Shiprocket API email
   * @param password - Shiprocket API password
   */
  async initialize(email: string, password: string): Promise<void> {
    this.email = email;
    this.password = password;

    // Authenticate and get token
    await this.authenticate();
  }

  /**
   * Authenticate with Shiprocket API
   * @returns Authentication token
   */
  async authenticate(): Promise<string> {
    if (!this.email || !this.password) {
      throw new Error(
        "Shiprocket credentials not configured. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD environment variables.",
      );
    }

    const response = await this.shiprocketConfigService.authenticate({
      email: this.email,
      password: this.password,
      baseUrl: this.baseUrl,
    });

    // Store token with expiration (default 24 hours if not provided)
    const expiresIn = response.expires_in || 86400; // 24 hours in seconds
    this.authToken = {
      token: response.token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return response.token;
  }

  /**
   * Get current authentication token
   * Automatically refreshes if expired
   * @returns Authentication token
   */
  async getAuthToken(): Promise<string> {
    // Authenticate if no token exists
    if (!this.authToken) {
      await this.authenticate();
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (
      this.authToken?.expiresAt &&
      Date.now() >= this.authToken.expiresAt - bufferTime
    ) {
      await this.authenticate();
    }

    // Final check - TypeScript should now know authToken is not null
    if (!this.authToken) {
      throw new Error("Failed to obtain authentication token");
    }

    return this.authToken.token;
  }

  /**
   * Check if Shiprocket is initialized
   * @returns true if Shiprocket is initialized
   */
  isInitialized(): boolean {
    return this.email !== null && this.password !== null;
  }

  /**
   * Test API connection
   * @returns Connection test result
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    authenticated: boolean;
  }> {
    if (!this.isInitialized()) {
      return {
        success: false,
        message: "Shiprocket is not initialized",
        authenticated: false,
      };
    }

    try {
      const token = await this.getAuthToken();
      return {
        success: true,
        message: "Shiprocket API connection successful",
        authenticated: !!token,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to connect to Shiprocket API",
        authenticated: false,
      };
    }
  }

  /**
   * Make authenticated API request to Shiprocket
   * @param endpoint - API endpoint (without base URL)
   * @param options - Fetch options
   * @returns API response
   */
  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getAuthToken();
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Shiprocket API request failed: ${error.message || response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Calculate shipping rates
   * @param pickupPincode - Pickup PIN code (seller location)
   * @param deliveryPincode - Delivery PIN code (buyer location)
   * @param weight - Weight in kg
   * @param orderValue - Order value in INR
   * @param codAmount - COD amount in INR (optional)
   * @returns Calculated rates for available couriers
   */
  async calculateRates(
    pickupPincode: string,
    deliveryPincode: string,
    weight: number,
    orderValue: number,
    codAmount?: number,
  ): Promise<{
    pickupPincode: string;
    deliveryPincode: string;
    weight: number;
    orderValue: number;
    codAmount: number | null;
    courierRates: Array<{
      courierId: number;
      courierName: string;
      rate: number;
      estimatedDeliveryDays: number | null;
      codCharges: number;
      totalRate: number;
      codAvailable: boolean;
      isRecommended: boolean;
    }>;
    totalCouriers: number;
    message: string;
  }> {
    if (!this.isInitialized()) {
      throw new Error(
        "Shiprocket is not initialized. Please initialize Shiprocket first.",
      );
    }

    // Prepare request payload for Shiprocket API
    const payload: {
      pickup_postcode: string;
      delivery_postcode: string;
      weight: number;
      cod_amount?: number;
      order_amount: number;
    } = {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight,
      order_amount: orderValue,
    };

    // Add COD amount if provided
    if (codAmount !== undefined && codAmount > 0) {
      payload.cod_amount = codAmount;
    }

    // Call Shiprocket rate calculation API
    const response = await this.makeRequest<{
      data: {
        available_courier_companies: Array<{
          id: number;
          courier_name: string;
          rate: number;
          estimated_delivery_days: number | null;
          cod_charges?: number;
          cod_available: boolean;
          is_recommended?: boolean;
        }>;
      };
    }>("/courier/serviceability/", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Transform Shiprocket response to our format
    const courierRates =
      response.data?.available_courier_companies?.map((courier) => {
        const codCharges = courier.cod_charges || 0;
        const totalRate = courier.rate + codCharges;

        return {
          courierId: courier.id,
          courierName: courier.courier_name,
          rate: courier.rate,
          estimatedDeliveryDays: courier.estimated_delivery_days,
          codCharges,
          totalRate,
          codAvailable: courier.cod_available || false,
          isRecommended: courier.is_recommended || false,
        };
      }) || [];

    return {
      pickupPincode,
      deliveryPincode,
      weight,
      orderValue,
      codAmount: codAmount || null,
      courierRates,
      totalCouriers: courierRates.length,
      message:
        courierRates.length > 0
          ? "Rates calculated successfully"
          : "No couriers available for this route",
    };
  }

  /**
   * Create shipment in Shiprocket and generate label
   * @param orderId - Order ID
   * @param courierId - Selected courier ID
   * @param pickupPincode - Optional pickup PIN code (defaults to seller location)
   * @param weight - Optional weight (will be calculated from order if not provided)
   * @returns Shipment details with AWB number and label URL
   */
  async createShipment(
    orderId: string,
    courierId: number,
    pickupPincode?: string,
    weight?: number,
  ): Promise<{
    shipmentId: number;
    awbNumber: string;
    trackingNumber: string;
    labelUrl: string;
    status: string;
    message: string;
  }> {
    if (!this.isInitialized()) {
      throw new Error(
        "Shiprocket is not initialized. Please initialize Shiprocket first.",
      );
    }

    // Get order details with shipping address
    const [order] = await this.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        total: orders.total,
        shippingAddressId: orders.shippingAddressId,
        customerId: orders.customerId,
        shippingProvider: orders.shippingProvider,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get shipping address
    const [shippingAddress] = await this.db
      .select()
      .from(addresses)
      .where(eq(addresses.id, order.shippingAddressId))
      .limit(1);

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Get customer details for phone and email
    let customerPhone = "";
    let customerEmail = "";
    if (order.customerId) {
      const [customer] = await this.db
        .select({
          phone: customers.phone,
          email: customers.email,
        })
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1);
      if (customer) {
        customerPhone = customer.phone || "";
        customerEmail = customer.email || "";
      }
    }

    // Get order items to calculate weight if not provided
    let calculatedWeight = weight;
    if (!calculatedWeight) {
      const items = await this.db
        .select({
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // Default weight calculation: 0.5 kg per item
      calculatedWeight = items.reduce(
        (sum, item) => sum + item.quantity * 0.5,
        0.5, // Minimum weight
      );
    }

    // Ensure we have a valid weight (fallback to 0.5kg minimum)
    calculatedWeight = calculatedWeight || 0.5;

    // Validate shipping address before proceeding
    this.validateShippingAddress(shippingAddress);

    // Get seller pickup PIN code (from environment or use default)
    const _sellerPincode =
      pickupPincode || process.env.SELLER_PINCODE || "400001";

    // Extract customer information with defaults
    const customerName = this.extractCustomerName(shippingAddress);

    // Prepare shipment creation payload for Shiprocket API
    const shipmentPayload = {
      order_id: order.orderNumber,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: "Primary",
      billing_customer_name: customerName,
      billing_last_name: "",
      billing_address: shippingAddress.street || "",
      billing_address_2: "",
      billing_city: shippingAddress.city || "",
      billing_state: shippingAddress.state || "",
      billing_country: shippingAddress.country || "India",
      billing_pincode: shippingAddress.pincode || "",
      billing_email: customerEmail,
      billing_phone: customerPhone,
      shipping_is_billing: true,
      shipping_customer_name: customerName,
      shipping_last_name: "",
      shipping_address: shippingAddress.street || "",
      shipping_address_2: "",
      shipping_city: shippingAddress.city || "",
      shipping_state: shippingAddress.state || "",
      shipping_country: shippingAddress.country || "India",
      shipping_pincode: shippingAddress.pincode || "",
      shipping_email: customerEmail,
      shipping_phone: customerPhone,
      order_items: await this.prepareOrderItems(orderId),
      payment_method: "Prepaid",
      sub_total: order.total.toString(),
      length: "10", // Default dimensions in cm
      breadth: "10",
      height: "10",
      weight: calculatedWeight.toString(),
    };

    // Create shipment in Shiprocket
    const createResponse = await this.makeRequest<{
      shipment_id: number;
      status: string;
      status_code: number;
      onboarding_completed_now: number;
      awb_code: string;
      courier_company_id: number;
      courier_name: string;
    }>("/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify(shipmentPayload),
    });

    // Assign AWB to shipment
    const awbResponse = await this.makeRequest<{
      response: {
        awb_assign_status: number;
        awb_code: string[];
      };
    }>("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({
        shipment_id: [createResponse.shipment_id],
      }),
    });

    const awbNumber = awbResponse.response.awb_code[0];

    // Generate label
    const labelResponse = await this.makeRequest<{
      label_created: number;
      response: {
        label_url: string;
      };
    }>("/courier/generate/label", {
      method: "POST",
      body: JSON.stringify({
        shipment_id: [createResponse.shipment_id],
      }),
    });

    const labelUrl = labelResponse.response.label_url;

    // Store shipment in database
    await this.db
      .insert(shipments)
      .values({
        orderId: orderId,
        provider: "shiprocket",
        trackingNumber: awbNumber,
        awbNumber: awbNumber,
        status: "label_generated",
        labelUrl: labelUrl,
      })
      .returning();

    // Update order shipping provider
    await this.db
      .update(orders)
      .set({
        shippingProvider: "shiprocket",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      shipmentId: createResponse.shipment_id,
      awbNumber: awbNumber,
      trackingNumber: awbNumber,
      labelUrl: labelUrl,
      status: "label_generated",
      message: "Shipment created and label generated successfully",
    };
  }

  /**
   * Prepare order items for Shiprocket shipment
   */
  private async prepareOrderItems(orderId: string): Promise<
    Array<{
      name: string;
      sku: string;
      units: number;
      selling_price: string;
    }>
  > {
    const items = await this.db
      .select({
        quantity: orderItems.quantity,
        price: orderItems.price,
        productVariantId: orderItems.productVariantId,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // For now, return simplified items
    // In production, you'd want to fetch product names and SKUs
    return items.map((item, index) => ({
      name: `Product ${index + 1}`,
      sku: item.productVariantId.substring(0, 8),
      units: item.quantity,
      selling_price: item.price.toString(),
    }));
  }

  /**
   * Track shipment by AWB number
   * @param awbNumber - AWB (Airway Bill) number
   * @returns Tracking information with events timeline
   */
  async trackShipment(awbNumber: string): Promise<{
    awbNumber: string;
    trackingNumber: string;
    status: string;
    statusDescription: string;
    estimatedDeliveryDate: string | null;
    events: Array<{
      date: string;
      status: string;
      location: string | null;
      description: string | null;
    }>;
    message: string;
  }> {
    if (!this.isInitialized()) {
      throw new Error(
        "Shiprocket is not initialized. Please initialize Shiprocket first.",
      );
    }

    // Track shipment via Shiprocket API
    const trackingResponse = await this.makeRequest<{
      tracking_data: {
        tracking_status: string;
        tracking_status_date: string;
        tracking_status_location: string;
        courier_tracking_id: string;
        estimated_delivery_date: string | null;
        shipment_track?: Array<{
          tracking_status: string;
          tracking_status_date: string;
          tracking_status_location: string;
          tracking_status_description: string | null;
        }>;
      };
    }>(`/courier/track/awb/${awbNumber}`, {
      method: "GET",
    });

    const trackingData = trackingResponse.tracking_data;

    // Transform tracking events
    const events =
      trackingData.shipment_track?.map((event) => ({
        date: event.tracking_status_date,
        status: event.tracking_status,
        location: event.tracking_status_location || null,
        description: event.tracking_status_description || null,
      })) || [];

    // Map Shiprocket status to our status
    const statusMap: Record<string, string> = {
      Pending: "pending",
      "Label Generated": "label_generated",
      "Picked Up": "picked_up",
      "In Transit": "in_transit",
      "Out for Delivery": "out_for_delivery",
      Delivered: "delivered",
      Failed: "failed",
      Returned: "returned",
      Cancelled: "cancelled",
    };

    const mappedStatus = statusMap[trackingData.tracking_status] || "pending";

    // Update shipment status in database if exists
    const [existingShipment] = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.awbNumber, awbNumber))
      .limit(1);

    if (existingShipment) {
      await this.db
        .update(shipments)
        .set({
          status: mappedStatus as
            | "pending"
            | "label_generated"
            | "picked_up"
            | "in_transit"
            | "out_for_delivery"
            | "delivered"
            | "failed"
            | "returned"
            | "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(shipments.awbNumber, awbNumber));
    }

    return {
      awbNumber: awbNumber,
      trackingNumber: trackingData.courier_tracking_id || awbNumber,
      status: mappedStatus,
      statusDescription: trackingData.tracking_status,
      estimatedDeliveryDate: trackingData.estimated_delivery_date || null,
      events: events,
      message: "Tracking information retrieved successfully",
    };
  }

  /**
   * Get available pickup locations from Shiprocket
   * @returns Array of pickup locations
   */
  async getPickupLocations(): Promise<
    Array<{
      id: number;
      name: string;
      pincode: string;
      city: string;
      state: string;
      country: string;
      address: string;
      phone: string;
      email: string;
      isDefault: boolean;
    }>
  > {
    if (!this.isInitialized()) {
      throw new Error(
        "Shiprocket is not initialized. Please initialize Shiprocket first.",
      );
    }

    const response = await this.makeRequest<{
      data: Array<{
        id: number;
        name: string;
        pincode: string;
        city: string;
        state: string;
        country: string;
        address: string;
        phone: string;
        email: string;
        is_default: boolean;
      }>;
    }>(SHIPROCKET_PICKUP_LOCATIONS_ENDPOINT, {
      method: "GET",
    });

    return (
      response.data?.map((location) => ({
        id: location.id,
        name: location.name,
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        country: location.country,
        address: location.address,
        phone: location.phone,
        email: location.email,
        isDefault: location.is_default || false,
      })) || []
    );
  }

  /**
   * Get courier serviceability (GET version with query params)
   * @param pickupPincode - Pickup PIN code
   * @param deliveryPincode - Delivery PIN code
   * @param weight - Weight in kg
   * @param orderValue - Order value in INR
   * @param codAmount - COD amount in INR (optional)
   * @returns Array of available couriers
   */
  async getCourierServiceability(
    pickupPincode: string,
    deliveryPincode: string,
    weight: number,
    orderValue: number,
    codAmount?: number,
  ): Promise<
    Array<{
      courierId: number;
      courierName: string;
      rate: number;
      estimatedDeliveryDays: number | null;
      codCharges: number;
      totalRate: number;
      codAvailable: boolean;
      isRecommended: boolean;
    }>
  > {
    // Use existing calculateRates method but return only courier rates
    const result = await this.calculateRates(
      pickupPincode,
      deliveryPincode,
      weight,
      orderValue,
      codAmount,
    );

    return result.courierRates;
  }

  /**
   * Cancel a shipment
   * @param awbNumber - AWB number of the shipment to cancel
   * @returns Cancelled shipment details
   */
  async cancelShipment(awbNumber: string): Promise<{
    awbNumber: string;
    status: string;
    message: string;
  }> {
    if (!this.isInitialized()) {
      throw new Error(
        "Shiprocket is not initialized. Please initialize Shiprocket first.",
      );
    }

    if (!awbNumber || awbNumber.trim().length === 0) {
      throw new Error("AWB number is required");
    }

    // Cancel shipment via Shiprocket API
    const response = await this.makeRequest<{
      message: string;
      status: number;
    }>(SHIPROCKET_CANCEL_SHIPMENT_ENDPOINT_TEMPLATE, {
      method: "POST",
      body: JSON.stringify({
        awbs: [awbNumber],
      }),
    });

    // Update shipment status in database
    const [updatedShipment] = await this.db
      .update(shipments)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(shipments.awbNumber, awbNumber))
      .returning();

    if (!updatedShipment) {
      throw new NotFoundException(
        `Shipment with AWB ${awbNumber} not found in database`,
      );
    }

    return {
      awbNumber,
      status: "cancelled",
      message: response.message || "Shipment cancelled successfully",
    };
  }

  /**
   * Validate shipping address before creating shipment
   */
  private validateShippingAddress(address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
  }): void {
    const errors: string[] = [];

    if (!address.street || address.street.trim() === "") {
      errors.push("Street address is required");
    }

    if (!address.city || address.city.trim() === "") {
      errors.push("City is required");
    }

    if (!address.state || address.state.trim() === "") {
      errors.push("State is required");
    }

    if (!address.pincode || address.pincode.trim() === "") {
      errors.push("PIN code is required");
    } else if (!/^\d{6}$/.test(address.pincode.trim())) {
      errors.push("PIN code must be 6 digits");
    }

    if (!address.country || address.country.trim() === "") {
      errors.push("Country is required");
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Invalid shipping address: ${errors.join(", ")}`,
      );
    }
  }

  /**
   * Extract customer name from address
   * Tries to get name from street address or uses default
   */
  private extractCustomerName(address: {
    street?: string | null;
    name?: string | null;
  }): string {
    // Try to get name from address.name field first
    if (address.name && address.name.trim() !== "") {
      return address.name.trim().split(" ")[0] || "Customer";
    }

    // Fallback: try to extract from street address (first part before comma)
    if (address.street?.includes(",")) {
      return address.street.split(",")[0].trim() || "Customer";
    }

    // Default fallback
    return "Customer";
  }
}
