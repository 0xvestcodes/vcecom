-- Atomic release Lua script
-- KEYS[1] = inventory:variant:{variantId} (total inventory)
-- KEYS[2] = inventory:reserved:{variantId} (aggregated reserved count)
-- KEYS[3] = inventory:reservation:{cartId}:{variantId} (individual reservation)
-- KEYS[4] = inventory:soft_reserved:{variantId} (global soft reservation counter, optional)
-- ARGV[1] = reservation mode ('hard' or 'soft')
--
-- Returns indexed array (ioredis cannot parse Lua associative tables):
-- On success: {'ok', released, reserved, available}
-- On no reservation: {'ok', 0, reserved, available}

local mode = ARGV[1] or 'hard'

-- Get current reservation quantity
local reservationQty = tonumber(redis.call('GET', KEYS[3]) or 0)

if reservationQty <= 0 then
  -- No reservation to release
  local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)
  local available = tonumber(redis.call('GET', KEYS[1]) or 0)
  return {'ok', 0, reserved, available}
end

-- Decrement aggregated reserved count
redis.call('INCRBY', KEYS[2], -reservationQty)

-- If soft mode, decrement soft reserved counter
if mode == 'soft' then
  redis.call('INCRBY', KEYS[4], -reservationQty)
end

-- Delete individual reservation key
redis.call('DEL', KEYS[3])

-- Get updated counts
local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)
local available = tonumber(redis.call('GET', KEYS[1]) or 0)

return {'ok', reservationQty, reserved, available}

