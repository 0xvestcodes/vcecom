import * as fs from "node:fs";
import * as path from "node:path";
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  addresses,
  customers,
  eq,
  invoices,
  orderItems,
  orders,
  products,
  productVariants,
  sql,
} from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import PDFDocument from "pdfkit";
import { ContextService } from "../../common/logging/context.service";
import { createErrorContext } from "../../common/logging/logging.helper";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import { DB_TOKEN } from "../../modules/database/database.module";
import type { Database } from "../../modules/database/db";
import { InvoiceResponseDto } from "./dto/invoice-response.dto";

@Injectable()
export class InvoicesService {
  private readonly invoicesDirectory = path.join(
    process.cwd(),
    "storage",
    "invoices",
  );

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
    @Inject(DB_TOKEN) private readonly db: Database,
  ) {
    // Ensure invoices directory exists
    this.ensureInvoicesDirectory();
  }

  /**
   * Ensure invoices directory exists
   */
  private ensureInvoicesDirectory(): void {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const yearDir = path.join(this.invoicesDirectory, String(year));
    const monthDir = path.join(yearDir, month);

    if (!fs.existsSync(this.invoicesDirectory)) {
      fs.mkdirSync(this.invoicesDirectory, { recursive: true });
    }
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
  }

  /**
   * Generate unique invoice number
   * Format: INV-YYYY-NNNNNN (e.g., INV-2025-000001)
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Get the last invoice number for this year
    let lastInvoice: { invoiceNumber: string } | undefined;
    try {
      const invoiceResult = await this.db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(sql`${invoices.invoiceNumber} LIKE ${`${prefix}%`}`)
        .orderBy(sql`${invoices.invoiceNumber} DESC`)
        .limit(1);
      lastInvoice = invoiceResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoiceNumber.selectLastInvoice",
          error,
          { prefix },
        ),
        "Failed to fetch last invoice number, starting from 1",
      );
      // Continue with sequence = 1
    }

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(
        lastInvoice.invoiceNumber.replace(prefix, ""),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(6, "0")}`;
  }

  /**
   * Get seller information (company details)
   */
  private getSellerInfo() {
    return {
      name: process.env.SELLER_NAME || "Vestcodes E-commerce",
      address: {
        street: process.env.SELLER_STREET || "123 Business Street",
        city: process.env.SELLER_CITY || "Mumbai",
        state: process.env.SELLER_STATE || "Maharashtra",
        pincode: process.env.SELLER_PINCODE || "400001",
        country: "India",
      },
      gstin: process.env.SELLER_GSTIN || "27ABCDE1234F1Z5",
      phone: process.env.SELLER_PHONE || "+91-9876543210",
      email: process.env.SELLER_EMAIL || "contact@vestcodes.co",
    };
  }

  /**
   * Generate invoice for an order
   */
  async generateInvoice(orderId: string): Promise<InvoiceResponseDto> {
    // Check if invoice already exists
    let existingInvoice: typeof invoices.$inferSelect | undefined;
    try {
      const invoiceResult = await this.db
        .select()
        .from(invoices)
        .where(eq(invoices.orderId, orderId))
        .limit(1);
      existingInvoice = invoiceResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectExistingInvoice",
          error,
          { orderId },
        ),
        "Failed to check existing invoice",
      );
      throw new InternalServerErrorException(
        "Failed to check existing invoice",
      );
    }

    if (existingInvoice) {
      return {
        ...existingInvoice,
        downloadUrl: `/api/invoices/${existingInvoice.id}/download`,
      };
    }

    // Get order details
    let order: typeof orders.$inferSelect | undefined;
    try {
      const orderResult = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      order = orderResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectOrder",
          error,
          { orderId },
        ),
        "Failed to fetch order",
      );
      throw new NotFoundException("Order not found");
    }

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Only generate invoice for confirmed/delivered orders
    if (
      !["confirmed", "processing", "shipped", "delivered"].includes(
        order.status,
      )
    ) {
      throw new BadRequestException(
        "Invoice can only be generated for confirmed or delivered orders",
      );
    }

    // Get order items with product details
    let orderItemsData: Array<{
      id: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      productVariantId: string;
      productId: string | null;
      productTitle: string | null;
      productHsnCode: string | null;
    }>;
    try {
      orderItemsData = await this.db
        .select({
          id: orderItems.id,
          quantity: orderItems.quantity,
          price: orderItems.price,
          gstRate: orderItems.gstRate,
          gstAmount: orderItems.gstAmount,
          productVariantId: orderItems.productVariantId,
          productId: products.id,
          productTitle: products.title,
          productHsnCode: products.hsnCode,
        })
        .from(orderItems)
        .leftJoin(
          productVariants,
          eq(orderItems.productVariantId, productVariants.id),
        )
        .leftJoin(products, eq(productVariants.productId, products.id))
        .where(eq(orderItems.orderId, orderId));
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectOrderItems",
          error,
          { orderId },
        ),
        "Failed to fetch order items",
      );
      throw new InternalServerErrorException("Failed to fetch order items");
    }

    // Get customer details
    let customer:
      | {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          gstin: string | null;
        }
      | undefined;
    try {
      const customerResult = await this.db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          gstin: customers.gstin,
        })
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1);
      customer = customerResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectCustomer",
          error,
          { orderId, customerId: order.customerId },
        ),
        "Failed to fetch customer",
      );
      throw new NotFoundException("Customer not found");
    }

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Get billing address
    let billingAddress: typeof addresses.$inferSelect | undefined;
    try {
      const addressResult = await this.db
        .select()
        .from(addresses)
        .where(eq(addresses.id, order.billingAddressId))
        .limit(1);
      billingAddress = addressResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectBillingAddress",
          error,
          { orderId, billingAddressId: order.billingAddressId },
        ),
        "Failed to fetch billing address",
      );
      throw new NotFoundException("Billing address not found");
    }

    if (!billingAddress) {
      throw new NotFoundException("Billing address not found");
    }

    // Get shipping address for GST calculation
    let shippingAddress: typeof addresses.$inferSelect | undefined;
    try {
      const addressResult = await this.db
        .select()
        .from(addresses)
        .where(eq(addresses.id, order.shippingAddressId))
        .limit(1);
      shippingAddress = addressResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.selectShippingAddress",
          error,
          { orderId, shippingAddressId: order.shippingAddressId },
        ),
        "Failed to fetch shipping address",
      );
      throw new NotFoundException("Shipping address not found");
    }

    if (!shippingAddress) {
      throw new NotFoundException("Shipping address not found");
    }

    // Calculate GST breakdown
    const sellerState = this.getSellerInfo().address.state;
    const buyerState = shippingAddress.state || "";

    const gstBreakdown = {
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: order.gstAmount,
      isIntraState: sellerState === buyerState,
    };

    // Calculate item-wise GST
    for (const item of orderItemsData) {
      const itemSubtotal = item.price * item.quantity;
      const itemGst = calculateGstBreakdown(
        itemSubtotal,
        item.gstRate,
        sellerState,
        buyerState,
      );
      gstBreakdown.cgst += itemGst.cgst;
      gstBreakdown.sgst += itemGst.sgst;
      gstBreakdown.igst += itemGst.igst;
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Generate PDF
    const pdfPath = await this.generateInvoicePdf({
      invoiceNumber,
      order,
      orderItems: orderItemsData,
      customer: {
        name: customer.name || "N/A",
        email: customer.email,
        phone: customer.phone,
        gstin: customer.gstin,
      },
      billingAddress,
      shippingAddress,
      gstBreakdown,
      sellerInfo: this.getSellerInfo(),
    });

    // Save invoice to database
    let invoice: typeof invoices.$inferSelect | undefined;
    try {
      const invoiceResult = await this.db
        .insert(invoices)
        .values({
          invoiceNumber,
          orderId: orderId,
          pdfPath,
        })
        .returning();
      invoice = invoiceResult[0];
    } catch (error) {
      this.logger.error(
        createErrorContext(
          this.contextService,
          "InvoicesService.generateInvoice.insertInvoice",
          error,
          { orderId, invoiceNumber, pdfPath },
        ),
        "Failed to save invoice to database",
      );
      throw new InternalServerErrorException("Failed to save invoice");
    }

    if (!invoice) {
      throw new InternalServerErrorException("Failed to create invoice");
    }

    return {
      ...invoice,
      downloadUrl: `/api/invoices/${invoice.id}/download`,
    };
  }

  /**
   * Generate invoice PDF
   */
  private async generateInvoicePdf(data: {
    invoiceNumber: string;
    order: typeof orders.$inferSelect;
    orderItems: Array<{
      id: string;
      quantity: number;
      price: number;
      gstRate: number;
      gstAmount: number;
      productTitle: string | null;
      productHsnCode: string | null;
    }>;
    customer: {
      name: string;
      email: string;
      phone: string | null;
      gstin: string | null;
    };
    billingAddress: typeof addresses.$inferSelect;
    shippingAddress: typeof addresses.$inferSelect;
    gstBreakdown: {
      cgst: number;
      sgst: number;
      igst: number;
      totalGst: number;
      isIntraState: boolean;
    };
    sellerInfo: {
      name: string;
      address: {
        street: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
      };
      gstin: string;
      phone: string;
      email: string;
    };
  }): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const fileName = `${data.invoiceNumber}.pdf`;
    const filePath = path.join(
      this.invoicesDirectory,
      String(year),
      month,
      fileName,
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text("TAX INVOICE", 50, 50);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Invoice No: ${data.invoiceNumber}`, 400, 50);
    doc.text(
      `Date: ${new Date(data.order.createdAt).toLocaleDateString("en-IN")}`,
      400,
      65,
    );
    doc.text(`Order No: ${data.order.orderNumber}`, 400, 80);

    // Seller Information
    doc.fontSize(12).font("Helvetica-Bold").text("From:", 50, 120);
    doc.fontSize(10).font("Helvetica");
    doc.text(data.sellerInfo.name, 50, 140);
    doc.text(data.sellerInfo.address.street, 50, 155);
    doc.text(
      `${data.sellerInfo.address.city}, ${data.sellerInfo.address.state} - ${data.sellerInfo.address.pincode}`,
      50,
      170,
    );
    doc.text(data.sellerInfo.address.country, 50, 185);
    doc.text(`GSTIN: ${data.sellerInfo.gstin}`, 50, 200);
    doc.text(`Phone: ${data.sellerInfo.phone}`, 50, 215);
    doc.text(`Email: ${data.sellerInfo.email}`, 50, 230);

    // Buyer Information
    doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 300, 120);
    doc.fontSize(10).font("Helvetica");
    doc.text(data.customer.name, 300, 140);
    doc.text(data.billingAddress.street, 300, 155);
    doc.text(
      `${data.billingAddress.city}, ${data.billingAddress.state} - ${data.billingAddress.pincode}`,
      300,
      170,
    );
    doc.text(data.billingAddress.country || "India", 300, 185);
    if (data.customer.gstin) {
      doc.text(`GSTIN: ${data.customer.gstin}`, 300, 200);
    }
    doc.text(`Phone: ${data.customer.phone || "N/A"}`, 300, 215);
    doc.text(`Email: ${data.customer.email}`, 300, 230);

    // Shipping Address (if different)
    if (data.billingAddress.id !== data.shippingAddress.id) {
      doc.fontSize(12).font("Helvetica-Bold").text("Ship To:", 50, 260);
      doc.fontSize(10).font("Helvetica");
      doc.text(data.shippingAddress.street, 50, 280);
      doc.text(
        `${data.shippingAddress.city}, ${data.shippingAddress.state} - ${data.shippingAddress.pincode}`,
        50,
        295,
      );
    }

    // Table Header
    let yPos = data.billingAddress.id !== data.shippingAddress.id ? 330 : 270;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("S.No", 50, yPos);
    doc.text("Description", 100, yPos);
    doc.text("HSN/SAC", 250, yPos);
    doc.text("Qty", 320, yPos);
    doc.text("Rate", 360, yPos);
    doc.text("Amount", 420, yPos);
    doc.text("GST%", 480, yPos);
    doc.text("Taxable", 520, yPos);

    yPos += 20;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();

    // Table Rows
    yPos += 10;
    let serialNumber = 1;
    for (const item of data.orderItems) {
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      const itemSubtotal = item.price * item.quantity;
      const taxableAmount = itemSubtotal - item.gstAmount;

      doc.fontSize(9).font("Helvetica");
      doc.text(String(serialNumber), 50, yPos);
      doc.text(item.productTitle || "Product", 100, yPos, { width: 140 });
      doc.text(item.productHsnCode || "N/A", 250, yPos);
      doc.text(String(item.quantity), 320, yPos);
      doc.text(`₹${item.price.toFixed(2)}`, 360, yPos);
      doc.text(`₹${itemSubtotal.toFixed(2)}`, 420, yPos);
      doc.text(`${item.gstRate}%`, 480, yPos);
      doc.text(`₹${taxableAmount.toFixed(2)}`, 520, yPos);

      yPos += 20;
      serialNumber++;
    }

    // Summary Section
    yPos += 10;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 20;

    doc.fontSize(10).font("Helvetica");
    doc.text("Subtotal:", 400, yPos);
    doc.text(`₹${data.order.subtotal.toFixed(2)}`, 520, yPos);

    if (data.gstBreakdown.isIntraState) {
      yPos += 20;
      doc.text("CGST:", 400, yPos);
      doc.text(`₹${data.gstBreakdown.cgst.toFixed(2)}`, 520, yPos);

      yPos += 20;
      doc.text("SGST:", 400, yPos);
      doc.text(`₹${data.gstBreakdown.sgst.toFixed(2)}`, 520, yPos);
    } else {
      yPos += 20;
      doc.text("IGST:", 400, yPos);
      doc.text(`₹${data.gstBreakdown.igst.toFixed(2)}`, 520, yPos);
    }

    yPos += 20;
    doc.text("Shipping:", 400, yPos);
    doc.text(`₹${data.order.shippingCost.toFixed(2)}`, 520, yPos);

    // Payment fee
    if (data.order.paymentFee && data.order.paymentFee > 0) {
      const paymentFeeInRupees = data.order.paymentFee / 100;
      const paymentMethodLabel = data.order.paymentMethod || "Payment Method";
      yPos += 20;
      doc.text(`Payment Fee (${paymentMethodLabel}):`, 400, yPos);
      doc.text(`₹${paymentFeeInRupees.toFixed(2)}`, 520, yPos);

      // Payment fee breakdown if available
      if (data.order.paymentFeeBreakdown) {
        const breakdown = data.order.paymentFeeBreakdown as {
          chargeType: string;
          flatAmount?: number;
          percentage?: number;
          calculatedFee: number;
        };
        yPos += 15;
        doc.fontSize(8).font("Helvetica");
        if (breakdown.chargeType === "FLAT" && breakdown.flatAmount) {
          doc.text(
            `  Base Fee: ₹${(breakdown.flatAmount / 100).toFixed(2)}`,
            400,
            yPos,
          );
        } else if (
          breakdown.chargeType === "PERCENTAGE" &&
          breakdown.percentage
        ) {
          doc.text(
            `  Percentage (${breakdown.percentage}%): ₹${paymentFeeInRupees.toFixed(2)}`,
            400,
            yPos,
          );
        } else if (breakdown.chargeType === "MIXED") {
          if (breakdown.flatAmount) {
            doc.text(
              `  Base Fee: ₹${(breakdown.flatAmount / 100).toFixed(2)}`,
              400,
              yPos,
            );
            yPos += 12;
          }
          if (breakdown.percentage) {
            const percentageFee =
              paymentFeeInRupees - (breakdown.flatAmount || 0) / 100;
            doc.text(
              `  Percentage (${breakdown.percentage}%): ₹${percentageFee.toFixed(2)}`,
              400,
              yPos,
            );
          }
        }
        doc.fontSize(10);
      }
    }

    yPos += 20;
    doc.moveTo(400, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total:", 400, yPos);
    doc.text(`₹${data.order.total.toFixed(2)}`, 520, yPos);

    // Footer
    yPos += 40;
    doc.fontSize(8).font("Helvetica");
    doc.text(
      "This is a computer-generated invoice and does not require a signature.",
      50,
      yPos,
      { align: "center", width: 500 },
    );

    doc.end();

    // Wait for PDF to be written
    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }

  /**
   * Get invoice by ID
   */
  async findOne(invoiceId: string): Promise<InvoiceResponseDto> {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    return {
      ...invoice,
      downloadUrl: `/api/invoices/${invoice.id}/download`,
    };
  }

  /**
   * Get invoice by order ID
   */
  async findByOrderId(orderId: string): Promise<InvoiceResponseDto | null> {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1);

    if (!invoice) {
      return null;
    }

    return {
      ...invoice,
      downloadUrl: `/api/invoices/${invoice.id}/download`,
    };
  }

  /**
   * Get invoice PDF file path
   */
  async getInvoicePdfPath(invoiceId: string): Promise<string> {
    const [invoice] = await this.db
      .select({ pdfPath: invoices.pdfPath })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    return invoice.pdfPath;
  }
}
