# Clean Code Guidelines

This document outlines the clean code principles and NestJS best practices that all code in this codebase must follow. Code is clean if it can be understood easily by everyone on the team. Clean code can be read and enhanced by a developer other than its original author.

---

## General Rules

1. **Follow standard conventions** - Use NestJS conventions, TypeScript best practices, and project-specific patterns consistently.
2. **Keep it simple stupid (KISS)** - Simpler is always better. Reduce complexity as much as possible.
3. **Boy scout rule** - Leave the campground cleaner than you found it. Always improve code quality when you touch it.
4. **Always find root cause** - Always look for the root cause of a problem, not just symptoms.

---

## Design Rules

1. **Keep configurable data at high levels** - Configuration should be centralized in `common/config/` or `common/constants/`.
2. **Prefer polymorphism to if/else or switch/case** - Use strategy pattern, factory pattern, or dependency injection for extensible behavior.
3. **Separate multi-threading code** - Use async/await properly, avoid blocking operations.
4. **Prevent over-configurability** - Don't make everything configurable; use sensible defaults.
5. **Use dependency injection** - All services must use NestJS DI. Never create dependencies directly with `new`.
6. **Follow Law of Demeter** - A class should know only its direct dependencies. Don't chain method calls through multiple objects.

---

## Understandability Tips

1. **Be consistent** - If you do something a certain way, do all similar things in the same way.
2. **Use explanatory variables** - Extract complex expressions into well-named variables.
3. **Encapsulate boundary conditions** - Boundary conditions are hard to keep track of. Put the processing for them in one place.
4. **Prefer dedicated value objects to primitive types** - Use DTOs and value objects instead of passing raw primitives.
5. **Avoid logical dependency** - Don't write methods that work correctly depending on something else in the same class.
6. **Avoid negative conditionals** - Prefer positive conditionals: `if (isValid)` instead of `if (!isInvalid)`.

---

## Names Rules

1. **Choose descriptive and unambiguous names** - Names should reveal intent.
2. **Make meaningful distinction** - Don't use `data`, `info`, `object` as names. Be specific.
3. **Use pronounceable names** - Code should read like prose: `customerId` not `custId`.
4. **Use searchable names** - Avoid single-letter variables except for loop counters (`i`, `j`, `k`).
5. **Replace magic numbers with named constants** - All numeric literals must be extracted to constants with JSDoc.
6. **Avoid encodings** - Don't append prefixes or type information (`strName`, `intCount`). TypeScript provides types.

---

## Functions Rules

1. **Small** - Functions should be < 20 lines (maximum 50 lines). If longer, extract methods.
2. **Do one thing** - A function should do one thing well. If you can extract another function, do it.
3. **Use descriptive names** - Function names should be verb phrases: `calculateTotal()`, `validateOrder()`.
4. **Prefer fewer arguments** - Functions with 0-2 arguments are ideal. 3+ arguments should be wrapped in an object.
5. **Have no side effects** - Functions should do what their name says, nothing more. Side effects should be explicit.
6. **Don't use flag arguments** - Split method into several independent methods that can be called without flags.

---

## Comments Rules

1. **Always try to explain yourself in code** - Good code is self-documenting. Prefer code clarity over comments.
2. **Don't be redundant** - Don't restate what the code obviously does.
3. **Don't add obvious noise** - Comments like `// increment counter` are noise.
4. **Don't use closing brace comments** - Modern IDEs show matching braces.
5. **Don't comment out code** - Just remove it. Git history preserves deleted code.
6. **Use as explanation of intent** - Explain *why* something is done, not *what* it does.
7. **Use as clarification of code** - Clarify complex algorithms or business rules.
8. **Use as warning of consequences** - Warn about performance implications or side effects.

---

## Source Code Structure

1. **Separate concepts vertically** - Related concepts should be close together.
2. **Related code should appear vertically dense** - Group related functions together.
3. **Declare variables close to their usage** - Don't declare variables at the top of functions.
4. **Dependent functions should be close** - If function A calls function B, place B directly below A.
5. **Similar functions should be close** - Group similar operations together.
6. **Place functions in the downward direction** - Higher-level functions should appear before lower-level ones.
7. **Keep lines short** - Maximum 120 characters per line.
8. **Don't use horizontal alignment** - Aligning code vertically is distracting.
9. **Use white space to associate related things** - Group related code with blank lines.
10. **Don't break indentation** - Maintain consistent indentation (2 spaces for TypeScript).

---

## Objects and Data Structures

1. **Hide internal structure** - Use private/protected modifiers appropriately.
2. **Prefer data structures** - Use DTOs and interfaces for data transfer.
3. **Avoid hybrid structures** - Don't mix objects (behavior) with data structures (data).
4. **Should be small** - Classes should be focused and small (< 500 lines for services).
5. **Do one thing** - Single Responsibility Principle: one reason to change.
6. **Small number of instance variables** - Keep dependencies minimal.
7. **Base class should know nothing about their derivatives** - Follow Liskov Substitution Principle.
8. **Better to have many functions than to pass code into a function** - Prefer composition over callbacks.
9. **Prefer non-static methods to static methods** - Static methods make testing harder.

---

## Tests

1. **One assert per test** - Each test should verify one behavior.
2. **Readable** - Tests should read like documentation. Use descriptive names.
3. **Fast** - Tests should run quickly (< 100ms per test).
4. **Independent** - Tests should not depend on each other or shared state.
5. **Repeatable** - Tests should produce the same results every time.

---

## Code Smells

Watch out for these code smells and refactor when you see them:

1. **Rigidity** - The software is difficult to change. A small change causes a cascade of subsequent changes.
2. **Fragility** - The software breaks in many places due to a single change.
3. **Immobility** - You cannot reuse parts of the code in other projects because of involved risks and high effort.
4. **Needless Complexity** - Over-engineering. Keep it simple.
5. **Needless Repetition** - DRY (Don't Repeat Yourself). Extract common code.
6. **Opacity** - The code is hard to understand. Improve naming and structure.

---

## NestJS Best Practices

### 1. Directory Structure

Follow this structure for each module:

```
modules/
├── orders/
│   ├── dto/                      # Data Transfer Objects
│   │   ├── create-order.dto.ts
│   │   └── order-response.dto.ts
│   ├── services/                 # Extracted services (if main service > 500 lines)
│   │   ├── order-validation.service.ts
│   │   └── order-pricing.service.ts
│   ├── orders.controller.ts      # HTTP request handling
│   ├── orders.module.ts          # Module definition
│   ├── orders.service.ts         # Main service (must be < 500 lines)
│   └── orders.constants.ts       # Module-specific constants
```

### 2. File Naming Conventions

- **Controllers**: `{module}.controller.ts` (e.g., `orders.controller.ts`)
- **Services**: `{module}.service.ts` (e.g., `orders.service.ts`)
- **Modules**: `{module}.module.ts` (e.g., `orders.module.ts`)
- **DTOs**: `{action}-{entity}.dto.ts` (e.g., `create-order.dto.ts`, `update-order.dto.ts`)
- **Constants**: `{module}.constants.ts` (e.g., `orders.constants.ts`)

### 3. Constants Organization

**Module-specific constants** (used only within that module):
- Location: `modules/{module}/{module}.constants.ts`
- Example: `modules/orders/orders.constants.ts`

**Global constants** (shared across modules):
- Location: `common/constants/{category}.constants.ts`
- Examples:
  - `common/constants/currency.constants.ts`
  - `common/constants/timeout.constants.ts`
  - `common/constants/pagination.constants.ts`

**All constants must:**
- Have JSDoc explaining *why* the constant exists
- Use SCREAMING_SNAKE_CASE
- Be exported from `common/constants/index.ts` if global

### 4. Service Size Limits

- **Maximum service file size**: 500 lines
- **Maximum function size**: 50 lines (prefer < 20 lines)
- **If a service exceeds 500 lines**: Extract focused services into `services/` subdirectory

### 5. Dependency Injection

Always use constructor injection:

```typescript
// ✅ Good
@Injectable()
export class OrdersService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly db: Database,
    private readonly cartsService: CartsService,
  ) {}
}

// ❌ Bad
@Injectable()
export class OrdersService {
  private logger = new PinoLogger();
  private db = new Database();
}
```

### 6. Configuration Management

Never access `process.env` directly. Use `AppConfigService`:

```typescript
// ✅ Good
constructor(private readonly appConfigService: AppConfigService) {}

getSellerState(): string {
  return this.appConfigService.getSellerState();
}

// ❌ Bad
getSellerState(): string {
  return process.env.SELLER_STATE || "Maharashtra";
}
```

### 7. Error Handling

Use NestJS exception filters and proper HTTP exceptions:

```typescript
// ✅ Good
if (!order) {
  throw new NotFoundException(`Order with ID ${orderId} not found`);
}

// ❌ Bad
if (!order) {
  throw new Error("Order not found");
}
```

### 8. DTOs for Validation

Always use DTOs with class-validator decorators:

```typescript
// ✅ Good
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  readonly cartId: string;

  @IsString()
  @IsUUID()
  readonly shippingAddressId: string;
}
```

### 9. Module Encapsulation

Group related controllers and providers into modules:

```typescript
@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderValidationService,
    OrderPricingService,
  ],
  exports: [OrdersService], // Export if used by other modules
})
export class OrdersModule {}
```

### 10. Global Exception Filter

Use a global exception filter for consistent error responses:

```typescript
// Already implemented in common/filters/global-exception.filter.ts
// All exceptions are caught and formatted consistently
```

---

## Service Decomposition Pattern

When a service exceeds 500 lines, decompose it following this pattern:

### Before (Monolithic Service)

```typescript
@Injectable()
export class OrdersService {
  // 2000+ lines of mixed concerns
  async create() { /* validation, pricing, DB, notifications */ }
  async update() { /* ... */ }
  async cancel() { /* ... */ }
}
```

### After (Decomposed Services)

```typescript
// Main service becomes orchestrator
@Injectable()
export class OrdersService {
  constructor(
    private readonly validationService: OrderValidationService,
    private readonly pricingService: OrderPricingService,
    private readonly creationService: OrderCreationService,
  ) {}

  async create(dto: CreateOrderDto) {
    const validated = await this.validationService.validate(dto);
    const pricing = await this.pricingService.calculate(validated);
    return this.creationService.create(validated, pricing);
  }
}

// Extracted services handle single responsibility
@Injectable()
export class OrderValidationService {
  async validate(dto: CreateOrderDto) { /* validation only */ }
}

@Injectable()
export class OrderPricingService {
  async calculate(data: ValidatedOrderData) { /* pricing only */ }
}

@Injectable()
export class OrderCreationService {
  async create(data: ValidatedOrderData, pricing: PricingData) { /* DB operations only */ }
}
```

---

## Magic Numbers

**All numeric literals must be extracted to constants:**

```typescript
// ❌ Bad
const amountInPaise = total * 100;
await new Promise((resolve) => setTimeout(resolve, 500));

// ✅ Good
import { PAISE_PER_RUPEE } from "../../common/constants/currency.constants";
import { RETRY_DELAY_MS } from "../../common/constants/timeout.constants";

const amountInPaise = total * PAISE_PER_RUPEE;
await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
```

**Constants must have JSDoc:**

```typescript
/**
 * Multiplier to convert INR (rupees) to paise (smallest unit)
 * Used for all monetary calculations to avoid floating point errors
 */
export const PAISE_PER_RUPEE = 100;

/**
 * Delay before retry operations in milliseconds
 * Allows transient errors to resolve before retrying
 */
export const RETRY_DELAY_MS = 500;
```

---

## Import Organization

Organize imports in this order:

1. External libraries (NestJS, third-party)
2. Internal modules (from other modules)
3. Relative imports (from same module)

```typescript
// External libraries
import { Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

// Internal modules
import { CartsService } from "../carts/carts.service";
import { ContextService } from "../../common/logging/context.service";

// Relative imports
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
```

---

## Code Review Checklist

Before submitting code, ensure:

- [ ] No service exceeds 500 lines
- [ ] No function exceeds 50 lines
- [ ] All magic numbers extracted to constants with JSDoc
- [ ] All constants follow naming convention (module vs global)
- [ ] Dependencies injected via constructor
- [ ] No direct `process.env` access
- [ ] Descriptive names (no abbreviations except common ones)
- [ ] Functions do one thing
- [ ] No commented-out code
- [ ] Comments explain "why", not "what"
- [ ] Tests written for new functionality
- [ ] Imports organized correctly

---

## References

- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Remember:** Code is written once but read many times. Write for the reader, not the writer.
