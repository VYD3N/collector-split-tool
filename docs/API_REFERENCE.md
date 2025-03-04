# Collector Split Tool API Reference

## Overview

The Collector Split Tool API provides endpoints for ranking collectors and calculating splits for NFT minting. The API is built with FastAPI and follows OpenAPI/Swagger standards.

## Base URL

```
http://localhost:8000
```

## Authentication

All endpoints (except `/health`) require API key authentication using the `X-API-Key` header.

```http
X-API-Key: your-api-key
```

## Rate Limiting

The API implements a sliding window rate limit of 10 requests per minute per IP address. When the rate limit is exceeded, the API returns a 429 status code with a `Retry-After` header.

## Endpoints

### GET /health

Health check endpoint to verify API status.

#### Response

```json
{
    "status": "healthy",
    "timestamp": "2024-02-19T00:00:00Z"
}
```

### GET /collectors/{collection_address}

Get ranked collectors for a specific collection.

#### Parameters

- `collection_address` (path) - The FA2 contract address
- `limit` (query, optional) - Maximum number of collectors to return (default: 10, max: 100)
- `days` (query, optional) - Number of days to look back for recent activity (default: 30, max: 365)

#### Response

```json
{
    "collectors": [
        {
            "address": "tz1...",
            "total_nfts": 5,
            "lifetime_spent": 30.5,
            "recent_purchases": 20.0,
            "score": 0.85
        }
    ]
}
```

### POST /calculate-splits

Calculate split percentages for top collectors.

#### Request Body

```json
{
    "collection_address": "KT1...",
    "total_share": 10.0,
    "min_collectors": 3,
    "max_collectors": 10
}
```

#### Response

```json
{
    "collectors": [
        {
            "address": "tz1...",
            "total_nfts": 5,
            "lifetime_spent": 30.5,
            "recent_purchases": 20.0,
            "score": 0.85,
            "share": 5.0
        }
    ]
}
```

### GET /stats/{collection_address}

Get statistics for a collection.

#### Parameters

- `collection_address` (path) - The FA2 contract address

#### Response

```json
{
    "name": "Test Collection",
    "total_tokens": 100,
    "total_holders": 50,
    "floor_price": 10.0,
    "total_volume": 1000.0
}
```

## Error Responses

The API uses standard HTTP status codes and returns error details in a consistent format:

```json
{
    "detail": "Error message"
}
```

Common error codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing API key)
- `403` - Forbidden (invalid API key)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Caching

The API implements caching with a 5-minute TTL for the following endpoints:
- `/collectors/{collection_address}`
- `/stats/{collection_address}`

Cache headers are included in the response:
```http
Cache-Control: max-age=300
ETag: "..."
```

## Examples

### Fetch Collectors

```bash
curl -X GET \
  "http://localhost:8000/collectors/KT1test?limit=5" \
  -H "X-API-Key: your-api-key"
```

### Calculate Splits

```bash
curl -X POST \
  "http://localhost:8000/calculate-splits" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "collection_address": "KT1test",
    "total_share": 10.0,
    "min_collectors": 3,
    "max_collectors": 5
  }'
```

### Get Collection Stats

```bash
curl -X GET \
  "http://localhost:8000/stats/KT1test" \
  -H "X-API-Key: your-api-key"
```

## WebSocket Events

The API provides real-time updates for transaction monitoring via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/transactions');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Transaction update:', data);
};
```

Event types:
- `transaction.pending` - Transaction is waiting for confirmations
- `transaction.confirmed` - Transaction has been confirmed
- `transaction.failed` - Transaction has failed

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| `/collectors/*` | 10/minute |
| `/calculate-splits` | 10/minute |
| `/stats/*` | 10/minute |
| WebSocket | No limit |

## Development

For local development, you can use the provided test API key:

```
X-API-Key: dev_key_123
```

## Support

For API support or to report issues, please open a GitHub issue or contact the development team.
