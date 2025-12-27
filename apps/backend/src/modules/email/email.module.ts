import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EmailService } from "./email.service";
import { EmailTemplatesService } from "./email-templates.service";
import { OrderEmailListener } from "./listeners/order-email.listener";

@Module({
  imports: [EventEmitterModule],
  providers: [EmailService, EmailTemplatesService, OrderEmailListener],
  exports: [EmailService, EmailTemplatesService],
})
export class EmailModule {}
