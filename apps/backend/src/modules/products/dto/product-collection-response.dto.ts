import { ApiProperty } from "@nestjs/swagger";

export class ProductCollectionResponseDto {
  @ApiProperty({
    description: "Collection ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Collection name",
    example: "Summer Sale",
  })
  name: string;

  @ApiProperty({
    description: "Collection slug",
    example: "summer-sale",
  })
  slug: string;

  @ApiProperty({
    description: "Collection description",
    example: "Hot summer deals and discounts",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Collection image URL",
    example: "https://example.com/images/summer-sale.jpg",
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}
