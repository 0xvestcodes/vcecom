import { ApiProperty } from "@nestjs/swagger";

export class GeoLocationDto {
  @ApiProperty({
    description: "Country name",
    example: "United States",
    nullable: true,
  })
  country?: string | null;

  @ApiProperty({
    description: "Country code (ISO 3166-1 alpha-2)",
    example: "US",
    nullable: true,
  })
  countryCode?: string | null;

  @ApiProperty({
    description: "Region/State name",
    example: "California",
    nullable: true,
  })
  region?: string | null;

  @ApiProperty({
    description: "Region/State code",
    example: "CA",
    nullable: true,
  })
  regionCode?: string | null;

  @ApiProperty({
    description: "City name",
    example: "San Francisco",
    nullable: true,
  })
  city?: string | null;

  @ApiProperty({
    description: "Postal code",
    example: "94102",
    nullable: true,
  })
  postalCode?: string | null;

  @ApiProperty({
    description: "Latitude",
    example: 37.7749,
    nullable: true,
  })
  latitude?: number | null;

  @ApiProperty({
    description: "Longitude",
    example: -122.4194,
    nullable: true,
  })
  longitude?: number | null;

  @ApiProperty({
    description: "Timezone",
    example: "America/Los_Angeles",
    nullable: true,
  })
  timezone?: string | null;

  @ApiProperty({
    description: "ISP",
    example: "Comcast Cable Communications",
    nullable: true,
  })
  isp?: string | null;

  @ApiProperty({
    description: "IP address",
    example: "192.168.1.1",
  })
  ipAddress: string;
}
