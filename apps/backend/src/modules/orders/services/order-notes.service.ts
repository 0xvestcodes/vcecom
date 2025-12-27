import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { desc, eq, orderNotes, orders } from "@vcecom/db";
import { PinoLogger } from "nestjs-pino";
import { DB_TOKEN } from "../../../modules/database/database.module";
import type { Database } from "../../../modules/database/db";
import { TimelineEventType } from "../dto/order-timeline.dto";
import { OrderTimelineService } from "./order-timeline.service";

@Injectable()
export class OrderNotesService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly timelineService: OrderTimelineService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DI
  ) {}

  /**
   * Get all notes for an order
   * @param orderId - Order ID
   * @returns Array of order notes
   */
  async findByOrderId(orderId: string) {
    // Verify order exists
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const notes = await this.db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, orderId))
      .orderBy(desc(orderNotes.createdAt));

    return notes;
  }

  /**
   * Create a new note for an order
   * @param orderId - Order ID
   * @param note - Note content
   * @param isPublic - Whether note is customer-visible
   * @param authorId - Admin user ID (optional)
   * @param authorName - Admin name (optional)
   * @param authorEmail - Admin email (optional)
   * @returns Created order note
   */
  async create(
    orderId: string,
    note: string,
    isPublic: boolean,
    authorId?: string,
    authorName?: string,
    authorEmail?: string,
  ) {
    if (!note || note.trim().length === 0) {
      throw new BadRequestException("Note content cannot be empty");
    }

    // Verify order exists
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const [createdNote] = await this.db
      .insert(orderNotes)
      .values({
        orderId,
        note: note.trim(),
        isPublic,
        authorId: authorId || null,
        authorName: authorName || null,
        authorEmail: authorEmail || null,
      })
      .returning();

    // Add timeline event
    await this.timelineService.addEvent(orderId, {
      type: isPublic
        ? TimelineEventType.NOTE_ADDED
        : TimelineEventType.ADMIN_NOTE_ADDED,
      title: isPublic ? "Note Added" : "Admin Note Added",
      description: note.trim(),
      actor: authorId ? "admin" : "system",
      actorId: authorId || undefined,
      actorName: authorName || undefined,
      actorEmail: authorEmail || undefined,
      timestamp: createdNote.createdAt,
      metadata: {
        noteId: createdNote.id,
        isPublic,
      },
    });

    this.logger.info(
      {
        orderId,
        noteId: createdNote.id,
        isPublic,
        authorId,
      },
      "Order note created",
    );

    return createdNote;
  }
}
