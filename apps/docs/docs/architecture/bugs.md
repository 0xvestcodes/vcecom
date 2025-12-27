# Bug Documentation

This document provides comprehensive documentation of bugs found in the codebase, their root causes, impact assessments, and implemented solutions.

## Overview

This document tracks critical bugs, their fixes, and any known limitations in the ecommerce system. Each bug entry includes:

- **Description**: What the bug does
- **Location**: Exact file and line numbers
- **Root Cause**: Why the bug exists
- **Impact**: What problems it causes
- **Solution**: How it was fixed

---

## Critical Bugs - Fixed

### BUG #1: Cart AddItem Race Condition

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/carts/carts.service.ts:1153-1167`

**Description**: The `addItem` method performed a non-atomic pre-check before calling the atomic Lua script. This created a time-of-check-time-of-use (TOCTOU) race condition window where multiple users could see the same "available" inventory simultaneously and pass the check before reservations were made.

**Root Cause**: The check `availableInventory - reservedInventory` was calculated separately from the reservation operation. Between the check and the reservation call, another user could reserve inventory, causing both requests to pass the check.

**Impact**: 
- Multiple users could add items to cart beyond available stock
- Overselling risk - orders could be created for items not actually in stock
- Inventory inconsistencies
- Poor user experience when orders fail at checkout

**Solution**: Removed the redundant pre-check and rely solely on the atomic Lua script validation in `reserve-inventory.lua`. The Lua script already performs the same check atomically and will throw `BadRequestException` if insufficient inventory.

**Fixed In**: Cart service refactor to rely on atomic operations

---

### BUG #2: Bundle AddItem Race Condition

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/carts/carts.service.ts:1257-1268`

**Description**: Same race condition as BUG #1, but occurring in the `addBundleToCart` method when checking inventory for bundle variants.

**Root Cause**: Non-atomic pre-check before atomic reservation, same TOCTOU issue as regular items.

**Impact**: Bundle additions could oversell inventory when multiple users add the same bundle simultaneously.

**Solution**: Removed redundant pre-check and rely on atomic Lua script validation.

**Fixed In**: Same refactor as BUG #1

---

### BUG #3: Cart Quantity Update Delta Bug

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/carts/carts.service.ts:1417`

**Description**: When updating cart item quantity, the availability check compared against the total new quantity instead of the delta (additional quantity needed).

**Example**:
- Current cart quantity: 3 (already reserved)
- User wants: 5 items
- Delta needed: 2 items
- Available inventory: 2 items
- **Current code checks**: `available < 5` → fails incorrectly ❌
- **Should check**: `available < 2` → should pass ✅

**Root Cause**: The check used `updateDto.quantity` instead of calculating the delta needed. This failed because it checked if there was enough total inventory for the new quantity, not accounting for what was already reserved.

**Impact**: 
- Users could not increase cart quantities even when enough additional inventory was available
- Frustrating user experience
- False "insufficient inventory" errors

**Solution**: Removed the redundant pre-check since the Lua script already handles delta calculation correctly (`deltaQty = qty - existingReservation`). The Lua script will throw an error if there's insufficient inventory for the delta.

**Fixed In**: Cart quantity update refactor

---

### BUG #4: Bundle Merge Double Reservation

**Status**: ✅ Verified (No Fix Needed)

**Location**: `apps/backend/src/modules/carts/carts.service.ts:1312-1316`

**Description**: When merging existing bundle items in `addBundleToCart`, the code calls `reserveInventory` with `newQuantity` but `existingItem.quantity` is already reserved.

**Root Cause**: Initial concern was potential double-reservation when merging bundle items.

**Impact**: None - verified correct behavior

**Solution**: Verified that the Lua script in `reserve-inventory.lua` correctly handles delta calculation:
```lua
local existingReservation = tonumber(redis.call('GET', KEYS[3]) or 0)
local deltaQty = qty - existingReservation
```
When merging, `existingReservation` contains the current reserved quantity, so `deltaQty` correctly calculates only the additional quantity needed. No fix needed.

**Fixed In**: N/A - verified correct behavior

---

### BUG #5: releaseCartReservations Redundant Get

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/redis-store/stores/inventory-store.ts:507-527`

**Description**: The `releaseCartReservations` method got reservations from `getCartReservations()` which already includes quantities, but then called `getReservation()` again redundantly.

**Root Cause**: Line 515 called `getReservation()` even though `reservation.quantity` was already available from `getCartReservations()` result (line 508).

**Impact**: 
- Unnecessary Redis round-trip
- Minor performance impact
- Slightly higher Redis load

**Solution**: Use `reservation.quantity` directly from `getCartReservations()` result instead of calling `getReservation()` again.

**Fixed In**: Inventory store optimization

---

### BUG #6: Inventory Health Metrics Naming

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/inventory/admin-inventory.service.ts:936`

**Description**: Variable `committedStock` was misleadingly named - it actually represents reserved inventory, not committed inventory.

**Root Cause**: Incorrect variable naming - reserved inventory was counted as "committed" which is semantically incorrect.

**Impact**: 
- Confusion in metrics interpretation
- Incorrect understanding of inventory state in admin dashboard
- Potential business decisions based on wrong data

**Solution**: Renamed `committedStock` to `reservedStock` throughout the method. Kept DTO field name `committedStock` for backward compatibility with API, but updated internal variable name and added comment clarifying it represents reserved stock.

**Fixed In**: Inventory health metrics refactor

---

### BUG #7: Inventory Health Edge Cases

**Status**: ✅ Fixed

**Location**: `apps/backend/src/modules/inventory/admin-inventory.service.ts:940-960`

**Description**: No handling for missing inventory keys, negative values, or invalid data scenarios.

**Root Cause**: Missing validation and error handling for edge cases in inventory calculation.

**Impact**: 
- Potential crashes when inventory keys are missing
- Incorrect metrics with negative inventory values
- Silent failures that could go unnoticed

**Solution**: Added comprehensive validation:
- Check if inventory key exists before parsing
- Handle negative inventory values (clamp to 0)
- Validate variantId extraction from keys
- Add try-catch around individual variant processing to skip errors gracefully
- Log warnings for problematic keys

**Fixed In**: Inventory health metrics robustness improvements

---

## Known Limitations

### BUG #8: TTL Expiry Not Decrementing Reserved Count

**Status**: ⚠️ Known Limitation (Handled by Reconciliation)

**Location**: Redis TTL expiration mechanism

**Description**: When reservation TTL expires in Redis, the individual reservation key (`inventory:reservation:{cartId}:{variantId}`) is automatically deleted by Redis, but the aggregated reserved count (`inventory:reserved:{variantId}`) is NOT decremented automatically.

**Root Cause**: Redis TTL expiration only deletes the key - it doesn't trigger any application logic to update related keys. This is a fundamental limitation of Redis TTL mechanism.

**Impact**: 
- Reserved count drifts higher than actual active reservations
- Inventory may appear unavailable when it's actually free
- Temporary inventory inconsistencies until reconciliation runs
- The reconciliation job handles this, but there's a window where counts are inconsistent

**Solution**: 
- Documented as known limitation
- Reliance on reconciliation job that runs every 7 minutes
- Reconciliation job compares aggregated reserved count with sum of individual reservations and corrects discrepancies
- Consider implementing Redis key expiration callbacks or Lua script on expiry if Redis version supports it (future enhancement)

**Mitigation**: 
- Reconciliation job runs frequently (every 7 minutes)
- Health metrics include reconciliation status
- Monitor for inconsistencies and alert if drift exceeds thresholds

**Future Enhancement**: If Redis 6.2+ is available, consider using Redis Streams or key space notifications to trigger cleanup on TTL expiry.

---

## Testing Recommendations

For each bug fix, the following tests should be performed:

1. **Concurrency Tests**: Multiple users adding same item to cart simultaneously
2. **Quantity Update Tests**: Various quantity update scenarios (increase, decrease, same)
3. **Inventory Edge Cases**: Negative values, missing keys, zero inventory
4. **Integration Tests**: Verify cart operations work correctly end-to-end
5. **Load Tests**: Verify system handles high concurrent cart additions

---

## Related Documentation

- [Inventory Flow](../checkout/inventory-flow.md)
- [Cart Integration](../bundles/cart-integration.md)
- [Inventory Reconciliation](../orders/inventory-reconciliation.md)
- [Health Checks](../observability/health-checks.md)

