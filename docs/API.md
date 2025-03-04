# API Documentation

## Overview

The Collector Split Tool API provides endpoints for calculating collector splits, managing token distributions, and monitoring transactions. This document describes the API endpoints, request/response formats, and authentication requirements.

## Base URL

```
http://localhost:8000
```

## Authentication

All endpoints (except `/health`) require an API key in the `X-API-Key` header.

Example:
```http
GET /collectors/KT1test
X-API-Key: your-api-key-here
```

## Rate Limiting

- 10 requests per minute per IP address
- Status code 429 when limit exceeded
- Reset time included in response headers

## Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2024-03-20T12:00:00Z"
}
```

### Get Ranked Collectors

```http
GET /collectors/{collection_address}
```

Parameters:
- `collection_address`: Tezos contract address (KT1...)
- `min_nfts` (optional): Minimum NFTs owned (default: 1)
- `max_collectors` (optional): Maximum collectors to return (default: 10)
- `include_stats` (optional): Include collector statistics (default: false)

Response:
```json
{
    "collectors": [
        {
            "address": "tz1test1",
            "rank": 1,
            "score": 0.85,
            "stats": {
                "total_nfts": 100,
                "lifetime_spent": 1000.5,
                "recent_purchases": 5
            }
        }
    ],
    "total_collectors": 50,
    "timestamp": "2024-03-20T12:00:00Z"
}
```

### Calculate Splits

```http
POST /splits/calculate
```

Request:
```json
{
    "collection_address": "KT1test",
    "total_share": 1000,  // 10% in basis points
    "min_collectors": 3,
    "max_collectors": 10,
    "min_share": 10,      // 0.1% in basis points
    "max_share": 5000     // 50% in basis points
}
```

Response:
```json
{
    "splits": [
        {
            "address": "tz1test1",
            "share": 500,  // 5% in basis points
            "rank": 1,
            "score": 0.85
        }
    ],
    "total_share": 1000,
    "collector_count": 3
}
```

### Get Transaction Status

```http
GET /transactions/{operation_hash}
```

Parameters:
- `operation_hash`: Tezos operation hash
- `wait_for_confirmation` (optional): Wait for N confirmations (default: 0)

Response:
```json
{
    "status": "applied",
    "confirmations": 30,
    "timestamp": "2024-03-20T12:00:00Z",
    "details": {
        "block_hash": "BL...",
        "block_level": 1234567,
        "gas_used": 10000
    }
}
```

### Get Collector Statistics

```http
GET /collectors/{address}/stats
```

Parameters:
- `address`: Tezos address (tz1...)
- `collection_address` (optional): Filter by collection
- `time_range` (optional): Time range in days (default: 30)

Response:
```json
{
    "address": "tz1test1",
    "stats": {
        "total_nfts": 100,
        "total_collections": 5,
        "lifetime_spent": 1000.5,
        "recent_activity": {
            "purchases": 5,
            "sales": 2,
            "volume": 500.25
        }
    },
    "collections": [
        {
            "address": "KT1test",
            "nfts_owned": 20,
            "first_purchase": "2024-01-01T00:00:00Z"
        }
    ]
}
```

## Error Responses

All error responses follow this format:

```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human readable message",
        "details": {
            "param": "Additional error context"
        }
    }
}
```

Common error codes:
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Pagination

For endpoints returning lists, pagination is supported via:

```http
GET /endpoint?page=1&limit=10
```

Response includes pagination metadata:
```json
{
    "data": [...],
    "pagination": {
        "page": 1,
        "limit": 10,
        "total": 100,
        "pages": 10
    }
}
```

## Filtering

Some endpoints support filtering via query parameters:

```http
GET /collectors?min_nfts=5&min_spent=100
```

## Sorting

Sort results using `sort` and `order` parameters:

```http
GET /collectors?sort=score&order=desc
```

## WebSocket API

Real-time updates are available via WebSocket connection:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

// Subscribe to transaction updates
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'transactions',
    params: {
        operation_hash: 'op...'
    }
}));

// Handle updates
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Update:', data);
};
```

## Development

### Local Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
export API_KEY=your-api-key
export PORT=8000
```

3. Run server:
```bash
uvicorn main:app --reload
```

### Testing

Run tests with:
```bash
pytest tests/
```

### Documentation

Generate OpenAPI docs:
```bash
python scripts/generate_openapi.py
```

View at: `http://localhost:8000/docs`

## Support

For API support or to report issues:
1. Check API status page
2. Review error logs
3. Contact support team
4. Open GitHub issue 