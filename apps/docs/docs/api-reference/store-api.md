# Store API Reference

## Base URL

```
https://api.example.com
```

## Authentication

Store endpoints use JWT authentication for customer-specific operations. However, guest checkout endpoints are public and do not require authentication.

## Endpoints

### Products

#### List Products
```http
GET /products?category=electronics&page=1
```

#### Get Product
```http
GET /products/:id
```

### Cart

#### Get Cart
```http
GET /cart
```

#### Add to Cart
```http
POST /cart/items
Content-Type: application/json

{
  "variantId": "uuid",
  "quantity": 2
}
```

### Checkout

#### Create Payment Intent (Authenticated)
```http
POST /orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "shippingAddressId": "uuid",
  "billingAddressId": "uuid",
  "shippingCost": 50.0
}
```

**Response:**
```json
{
  "paymentIntent": {
    "paymentIntentId": "pi_123",
    "paymentProvider": "razorpay",
    "status": "CREATED"
  },
  "checkoutSessionId": "session-123",
  "message": "Payment intent created successfully"
}
```

#### Create Payment Intent (Guest Checkout)
```http
POST /orders
X-Session-Id: {session-id}
Content-Type: application/json

{
  "email": "guest@example.com",
  "name": "Guest User",
  "phone": "+919876543210",
  "address": {
    "type": "shipping",
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "district": "Mumbai",
    "country": "India"
  },
  "password": "SecurePassword123!",
  "shippingCost": 50.0
}
```

**Note:** 
- `password` is optional. If provided, creates an account instead of guest checkout.
- `X-Session-Id` header is required for guest checkout to link the cart.
- Guest checkout does not require authentication.

**Response:** Same as authenticated checkout.

### Orders

#### List Orders (Authenticated Only)
```http
GET /orders
Authorization: Bearer {token}
```

#### Get Order (Authenticated Only)
```http
GET /orders/:id
Authorization: Bearer {token}
```

### Customers

#### Claim Guest Account
```http
POST /customers/claim
Content-Type: application/json

{
  "email": "guest@example.com",
  "token": "verification-token",
  "newPassword": "SecurePassword123!"
}
```

**Response:**
```json
{
  "id": "customer-uuid",
  "email": "guest@example.com",
  "name": "Guest User",
  "isGuest": false,
  "emailVerified": true
}
```

**Note:** This endpoint converts a guest customer to a regular account by setting a password.

### Reviews

#### List Reviews
```http
GET /products/:id/reviews
```

#### Create Review
```http
POST /products/:id/reviews
Content-Type: application/json

{
  "rating": 5,
  "comment": "Great product!"
}
```

## Response Format

See [Admin API Response Format](/docs/api-reference/admin-api#response-format) for response structure.

## Interactive API Documentation

For complete API documentation with interactive testing, see:

- **[Store API Interactive Docs](/api-reference/store)** - Full OpenAPI specification with Redoc
- **OpenAPI JSON**: Available at `/api/docs-json` endpoint

The interactive documentation includes:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication examples

