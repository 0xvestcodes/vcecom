-- Atomic commit reservation Lua script
-- Releases reservation AND decrements inventory in single atomic operation
-- KEYS[1] = inventory:variant:{variantId} (total inventory)
-- KEYS[2] = inventory:reserved:{variantId} (aggregated reserved count)
-- KEYS[3] = inventory:reservation:{cartId}:{variantId} (individual reservation)
-- KEYS[4] = inventory:soft_reserved:{variantId} (global soft reservation counter, if applicable)
-- ARGV[1] = quantity to commit
-- ARGV[2] = reservation mode ('hard' or 'soft')
--
-- Returns indexed array (ioredis cannot parse Lua associative tables):
-- On success: {'ok', newInventory, reserved, released}
-- On error: {'err', errorType, expected/actual (for mismatch), quantity (for no reservation)}

local requestedQty = tonumber(ARGV[1])
local mode = ARGV[2] or 'hard'

-- Get current reservation quantity
local reservationQty = tonumber(redis.call('GET', KEYS[3]) or 0)

-- Verify reservation matches requested quantity
if reservationQty ~= requestedQty then
  return {'err', 'RESERVATION_MISMATCH', requestedQty, reservationQty}
end

if reservationQty <= 0 then
  return {'err', 'NO_RESERVATION', 0}
end

-- Delete individual reservation key
redis.call('DEL', KEYS[3])

-- Decrement aggregated reserved count
redis.call('INCRBY', KEYS[2], -reservationQty)

-- If soft mode, decrement soft reserved counter
if mode == 'soft' then
  redis.call('INCRBY', KEYS[4], -reservationQty)
end

-- Decrement actual inventory (available stock) - CRITICAL ATOMIC OPERATION
local newInventory = redis.call('INCRBY', KEYS[1], -reservationQty)

-- Get updated reserved count
local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)

return {'ok', newInventory, reserved, reservationQty}

