
### Orders

#### POST /orders

Creates a new payment order.

**Request:**
```http
POST /orders
Content-Type: application/json
```

**Request Body:**
```json
{
  "order_id": 12345,
  "amount": "150.00",
  "currency": "BDT",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+8801712345678",
  "return_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel",
  "api_key": "your-api-key",
  "webhook_url": "https://example.com/webhook"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_id` | number | Yes | Unique order identifier |
| `amount` | string | Yes | Payment amount |
| `currency` | string | Yes | Currency code (e.g., "BDT") |
| `customer_name` | string | Yes | Customer's full name |
| `customer_email` | string | Yes | Valid email address |
| `customer_phone` | string | Yes | Customer's phone number |
| `return_url` | string | Yes | Valid URL for successful payment redirect |
| `cancel_url` | string | Yes | Valid URL for cancelled payment redirect |
| `api_key` | string | Yes | API key for authentication |
| `webhook_url` | string | No | Optional webhook URL to be called when transaction is verified |

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order_id": 12345,
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Status Code:** `201 Created`

**Error Responses:**
- `400 Bad Request` - Validation errors (missing required fields, invalid email/URL format)

---

#### GET /orders/details/:id

Retrieves order details by transaction ID.

**Request:**
```http
GET /orders/details/{transaction_id}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Transaction ID (UUID) |

**Response:**
```json
{
  "id": 1,
  "order_data": {
    "order_id": 12345,
    "amount": "150.00",
    "currency": "BDT",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "+8801712345678",
    "return_url": "https://example.com/success",
    "cancel_url": "https://example.com/cancel",
    "api_key": "your-api-key"
  },
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Status Code:** `200 OK`



## Examples

### Complete Payment Flow

1. **Create an order:**
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 12345,
    "amount": "150.00",
    "currency": "BDT",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "+8801712345678",
    "return_url": "https://example.com/success",
    "cancel_url": "https://example.com/cancel",
    "api_key": "your-api-key",
    "webhook_url": "https://example.com/webhook"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order_id": 12345,
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:30:00.000Z",
  "payment_url": "https://pay.fivedit.com/f635dcde-05b2-45c9-9356-280069bc32c3"
}
```
Method:get
http://localhost:3000/orders/status/{{transaction_id}}