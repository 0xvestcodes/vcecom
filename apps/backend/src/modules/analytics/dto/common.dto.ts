import { ApiProperty } from "@nestjs/swagger";

export class DateRangeDto {
  @ApiProperty({
    description: "Start date",
    example: "2024-01-01T00:00:00Z",
  })
  startDate: Date;

  @ApiProperty({
    description: "End date",
    example: "2024-01-31T23:59:59Z",
  })
  endDate: Date;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
