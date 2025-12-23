import { ApiProperty } from "@nestjs/swagger";

export class AnalysisResponseDto {
  @ApiProperty({
    description: "Success message",
    example: "Analysis completed successfully",
  })
  message: string;
}

export class AssociationStatisticsResponseDto {
  @ApiProperty({
    description: "Total number of product associations",
    example: 1250,
  })
  totalAssociations: number;

  @ApiProperty({
    description: "Average confidence score across all associations",
    example: 0.75,
  })
  averageConfidence: number;

  @ApiProperty({
    description: "Number of products that have associations",
    example: 320,
  })
  productsWithAssociations: number;
}

export class FrequentlyBoughtTogetherItemDto {
  @ApiProperty({
    description: "Associated product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "Confidence score (0-1)",
    example: 0.85,
  })
  confidenceScore: number;
}

export class FrequentlyBoughtTogetherResponseDto {
  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "List of frequently bought together products",
    type: [FrequentlyBoughtTogetherItemDto],
  })
  associations: FrequentlyBoughtTogetherItemDto[];
}

