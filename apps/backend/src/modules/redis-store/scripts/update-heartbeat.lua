-- Atomic heartbeat update Lua script
-- Prevents race conditions with cleanup jobs
-- KEYS[1] = heartbeat:{cartId}
-- KEYS[2] = cart:stale:{cartId} (stale marker)
-- KEYS[3] = checkout:lock:{cartId} (checkout lock)
-- ARGV[1] = ttl seconds

local ttl = tonumber(ARGV[1] or 120)

-- Check if checkout lock exists - if yes, skip heartbeat update (checkout in progress)
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {ok = false, reason = 'CHECKOUT_IN_PROGRESS'}
end

-- Check if cart is marked stale - if yes, return error (cleanup in progress)
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {ok = false, reason = 'CART_STALE'}
end

-- Set heartbeat key with TTL
redis.call('SET', KEYS[1], '1', 'EX', ttl)

-- Delete stale marker if exists (cart is active again)
redis.call('DEL', KEYS[2])

return {ok = true}

