-- Atomic reacquisition Lua script
-- Reacquires inventory for checkout with checkout lock
-- KEYS[1] = inventory:variant:{variantId} (total inventory)
-- KEYS[2] = inventory:reserved:{variantId} (aggregated reserved count)
-- KEYS[3] = inventory:reservation:{cartId}:{variantId} (individual reservation)
-- KEYS[4] = checkout:lock:{cartId} (checkout lock)
-- ARGV[1] = requested quantity
-- ARGV[2] = checkout TTL (120s)
--
-- Returns indexed array (ioredis cannot parse Lua associative tables):
-- On failure: {0, actuallyAvailable, requested}
-- On success: {1, reacquired, newAvailable, newReserved}

local available = tonumber(redis.call('GET', KEYS[1]) or 0)
local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)
local requested = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

-- Get existing reservation for this cart (if any)
local existingReservation = tonumber(redis.call('GET', KEYS[3]) or 0)

-- Calculate truly available inventory
-- If there's an existing reservation, it's already counted in 'reserved'
-- So we need: available - (reserved - existingReservation) - requested >= 0
-- Which simplifies to: available - reserved + existingReservation - requested >= 0
local actuallyAvailable = available - reserved + existingReservation

-- Check if we can fulfill request
if actuallyAvailable < requested then
  -- Return failure as indexed array: {valid=0, available, requested}
  return {0, actuallyAvailable, requested}
end

-- Clear old reservation if it exists (decrement reserved counter)
if existingReservation > 0 then
  redis.call('INCRBY', KEYS[2], -existingReservation)
end

-- Create new reservation with checkout TTL
redis.call('SET', KEYS[3], requested, 'EX', ttl)
redis.call('INCRBY', KEYS[2], requested)

-- Set checkout lock (only if not already set - use SET with EX for idempotency)
redis.call('SET', KEYS[4], '1', 'EX', ttl)

-- Return success as indexed array: {valid=1, reacquired, newAvailable, newReserved}
local newReserved = tonumber(redis.call('GET', KEYS[2]) or 0)
local newAvailable = available - newReserved
return {1, requested, newAvailable, newReserved}

