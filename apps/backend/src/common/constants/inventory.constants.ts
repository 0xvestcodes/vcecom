/**
 * Inventory reservation thresholds
 * These determine when to switch between hard and soft reservations
 */
export const INVENTORY_THRESHOLDS = {
  /**
   * Below this threshold, enable soft reservations with warnings
   * Above this threshold, use standard hard reservations
   */
  LOW_STOCK_THRESHOLD: 10,

  /**
   * Maximum overbooking multiplier for soft reservations
   * Allows 1.5x inventory to be added to carts (50% overbooking)
   */
  SOFT_RESERVATION_MULTIPLIER: 1.5,

  /**
   * Minimum units required to allow soft reservations
   * Never allow overbooking below this absolute minimum
   */
  MIN_UNITS_FOR_SOFT_RESERVATION: 3,
} as const;

export const RESERVATION_MODES = {
  HARD: "hard",
  SOFT: "soft",
  WAITLIST: "waitlist",
} as const;

export type ReservationMode =
  (typeof RESERVATION_MODES)[keyof typeof RESERVATION_MODES];

export const RESERVATION_TTL_TIERS = {
  HIGH_STOCK: 900, // 15 min (> 10 units)
  MEDIUM_STOCK: 420, // 7 min (4-10 units)
  LOW_STOCK: 180, // 3 min (≤ 3 units)
} as const;

export const CHECKOUT_LOCK_TTL = 120; // 2 minutes - freeze during checkout
