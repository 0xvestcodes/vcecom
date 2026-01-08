import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";

export class ReorderItemsDto {
  @ApiProperty({
    description: "Array of item IDs in the desired order",
    example: [
      "123e4567-e89b-12d3-a456-426614174000",
      "223e4567-e89b-12d3-a456-426614174001",
    ],
    type: [String],
  })
  @IsArray({ message: "Item IDs must be an array" })
  @IsUUID(4, { each: true, message: "Each item ID must be a valid UUID" })
  itemIds: string[];
}
