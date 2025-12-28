import { ApiProperty } from "@nestjs/swagger";

export class VariantInventoryResponseDto {
  @ApiProperty({
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  variantId: string;

  @ApiProperty({
    description: "Available inventory (total - reserved)",
    example: 25,
  })
  available: number;

  @ApiProperty({
    description: "Reserved inventory (in carts)",
    example: 5,
  })
  reserved: number;

  @ApiProperty({
    description: "Total inventory",
    example: 30,
  })
  total: number;
}
