-- Atomic reservation Lua script
-- KEYS[1] = inventory:variant:{variantId} (total inventory)
-- KEYS[2] = inventory:reserved:{variantId} (aggregated reserved count)
-- KEYS[3] = inventory:reservation:{cartId}:{variantId} (individual reservation)
-- KEYS[4] = inventory:soft_reserved:{variantId} (global soft reservation counter, optional)
-- ARGV[1] = quantity to reserve
-- ARGV[2] = ttlSeconds
-- ARGV[3] = reservationMode ('hard' or 'soft', optional, defaults to 'hard')
-- ARGV[4] = softReservationLimit (only used in soft mode, optional)
--
-- Returns indexed array (ioredis cannot parse Lua associative tables):
-- On success: {'ok', available, reserved, mode, totalSoftReserved}
-- On error: {'err', 'INSUFFICIENT_INVENTORY', available, mode}

local available = tonumber(redis.call('GET', KEYS[1]) or 0)
local reserved = tonumber(redis.call('GET', KEYS[2]) or 0)
-- Handle optional KEYS[4] - safely get soft reserved count
local softReserved = 0
if KEYS[4] and type(KEYS[4]) == 'string' then
  softReserved = tonumber(redis.call('GET', KEYS[4]) or 0)
end
local qty = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local mode = ARGV[3] or 'hard'
local softLimit = tonumber(ARGV[4] or 0)

-- Check if reservation already exists for this cart
local existingReservation = tonumber(redis.call('GET', KEYS[3]) or 0)
local deltaQty = qty - existingReservation

-- Calculate what the reserved count will be after this operation
local newReserved = reserved + deltaQty

-- In HARD mode: enforce strict availability (available - reserved >= quantity)
if mode == 'hard' then
  local availableAfterReserved = available - newReserved
  if availableAfterReserved < 0 then
    local currentAvailable = available - reserved
    return {'err', 'INSUFFICIENT_INVENTORY', currentAvailable, 'hard'}
  end
end

-- In SOFT mode: enforce reserved_total <= inventory * SOFT_MULTIPLIER (global and atomic)
if mode == 'soft' then
  -- Calculate new soft reserved count (only count soft reservations)
  local existingSoftReservation = 0
  if existingReservation > 0 then
    -- Check if existing reservation was soft (we track this separately)
    -- For simplicity, assume if we're updating to soft, existing was also soft
    existingSoftReservation = existingReservation
  end
  local newSoftReserved = softReserved + (qty - existingSoftReservation)
  
  -- Enforce global soft limit: reserved_total <= inventory * SOFT_MULTIPLIER
  if newSoftReserved > softLimit then
    local currentAvailable = available - reserved
    return {'err', 'INSUFFICIENT_INVENTORY', currentAvailable, 'soft'}
  end
  
  -- Update soft reserved counter (only if KEYS[4] exists)
  if KEYS[4] and type(KEYS[4]) == 'string' then
    if deltaQty > 0 then
      redis.call('INCRBY', KEYS[4], deltaQty)
    elseif deltaQty < 0 then
      redis.call('INCRBY', KEYS[4], deltaQty)
    end
  end
end

-- Update reservations
if deltaQty > 0 then
  -- Need to reserve more - increment aggregated reserved count
  redis.call('INCRBY', KEYS[2], deltaQty)
elseif deltaQty < 0 then
  -- Need to release some - decrement aggregated reserved count
  redis.call('INCRBY', KEYS[2], deltaQty)
end

-- Set or update individual reservation with TTL
redis.call('SET', KEYS[3], qty, 'EX', ttl)

local availableAfterReserved = available - newReserved
local totalSoftReserved = 0
if KEYS[4] and type(KEYS[4]) == 'string' then
  totalSoftReserved = tonumber(redis.call('GET', KEYS[4]) or 0)
end
return {'ok', availableAfterReserved, newReserved, mode, totalSoftReserved}

