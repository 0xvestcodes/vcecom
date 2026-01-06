import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CustomerEventsService } from "./customer-events.service";
import { OrderEventsService } from "./order-events.service";
import { ProductEventsService } from "./product-events.service";

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [OrderEventsService, ProductEventsService, CustomerEventsService],
  exports: [OrderEventsService, ProductEventsService, CustomerEventsService],
})
export class EventsModule {}
