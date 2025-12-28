-- Set checkout lock Lua script
-- Freezes reservation during checkout window
-- KEYS[1] = checkout:lock:{cartId}
-- ARGV[1] = ttl seconds (90-120s)

local ttl = tonumber(ARGV[1] or 120)

-- Set checkout lock with TTL
redis.call('SET', KEYS[1], '1', 'EX', ttl)

return {ok = true}

