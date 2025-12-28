import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { OrderEventsService } from "./order-events.service";

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class EventsModule {}
