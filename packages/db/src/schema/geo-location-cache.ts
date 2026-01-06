import {
  index,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Geo location cache table
 * Caches IP geolocation lookups for performance
 */
export const geoLocationCache = pgTable(
  "geo_location_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ipAddress: text("ip_address").notNull(),
    country: text("country"),
    countryCode: text("country_code"), // ISO 3166-1 alpha-2
    region: text("region"), // State/province
    regionCode: text("region_code"), // State code
    city: text("city"),
    postalCode: text("postal_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    timezone: text("timezone"),
    isp: text("isp"),
    cachedAt: timestamp("cached_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // TTL: 7 days by default
  },
  (table) => ({
    ipAddressIdx: index("geo_location_cache_ip_address_idx").on(
      table.ipAddress,
    ),
    countryCodeIdx: index("geo_location_cache_country_code_idx").on(
      table.countryCode,
    ),
    regionCodeIdx: index("geo_location_cache_region_code_idx").on(
      table.regionCode,
    ),
    expiresAtIdx: index("geo_location_cache_expires_at_idx").on(
      table.expiresAt,
    ),
  }),
);

export type GeoLocationCache = typeof geoLocationCache.$inferSelect;
export type NewGeoLocationCache = typeof geoLocationCache.$inferInsert;
