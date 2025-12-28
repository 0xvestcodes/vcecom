-- Validate inventory Lua script
-- Reads ONLY from Redis, never touches DB
-- KEYS[1] = inventory:variant:{variantId} (total inventory)
-- KEYS[2] = inventory:reserved:{variantId} (aggregated reserved count)
-- KEYS[3] = inventory:reservation:{cartId}:{variantId} (individual reservation)
-- ARGV[1] = quantity to validate
--
-- Returns indexed array (ioredis cannot parse Lua associative tables):
-- {valid (0 or 1), actuallyAvailable, requestedQty}

local available = tonumber(redis.call('GET', KEYS[1]) or 0)
local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)
local cartReservation = tonumber(redis.call('GET', KEYS[3]) or 0)
local requestedQty = tonumber(ARGV[1])

-- Calculate available inventory: available - (reserved - cartReservation)
-- This accounts for the cart's current reservation
local actuallyAvailable = available - (reserved - cartReservation)

if actuallyAvailable < requestedQty then
  return {0, actuallyAvailable, requestedQty}
end

return {1, actuallyAvailable, requestedQty}

