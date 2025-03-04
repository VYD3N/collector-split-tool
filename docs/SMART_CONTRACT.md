# Smart Contract Documentation

## Overview

The Collector Split Tool interacts with OBJKT.com's Open Edition contract to implement dynamic split distributions for NFT minting. This document describes the contract interface, split calculation logic, and integration details.

## Contract Address

```
KT1JtUU7d1boS9WVHu2B2obTE4gdX2uyFMVq  # OBJKT Open Edition Contract
```

## Contract Interface

### Entrypoints

#### `mint`

Mint tokens with collector splits.

```typescript
type Split = {
    address: string;  // Tezos address (tz1...)
    shares: number;   // In basis points (1/1000)
}

type MintParams = {
    amount: number;   // Number of tokens to mint
    splits: Split[];  // List of collector splits
}
```

Example:
```typescript
const splits = [
    { address: "tz1test1", shares: 500 },  // 5%
    { address: "tz1test2", shares: 300 },  // 3%
    { address: "tz1test3", shares: 200 }   // 2%
];

const params = {
    amount: 1,
    splits: splits
};

// Mint with splits
const operation = await contract.methods.mint(params).send();
```

#### `update_operators`

Update contract operators for managing token permissions.

```typescript
type OperatorParam = {
    owner: string;     // Token owner address
    operator: string;  // Operator address
    token_id: number;  // Token ID
}

type OperatorUpdate = {
    add_operator?: OperatorParam;
    remove_operator?: OperatorParam;
}
```

Example:
```typescript
const updates = [
    {
        add_operator: {
            owner: "tz1test1",
            operator: "tz1test2",
            token_id: 1
        }
    }
];

// Update operators
const operation = await contract.methods.update_operators(updates).send();
```

## Split Calculation

### Algorithm

The split calculation algorithm works as follows:

1. **Collector Ranking**
   - Total NFTs owned (40% weight)
   - Lifetime tez spent (40% weight)
   - Recent purchases (20% weight)

2. **Score Normalization**
   ```python
   normalized_nfts = collector.total_nfts / max_total_nfts
   normalized_spent = collector.lifetime_spent / max_lifetime_spent
   normalized_recent = collector.recent_purchases / max_recent_purchases
   
   score = (
       normalized_nfts * 0.4 +
       normalized_spent * 0.4 +
       normalized_recent * 0.2
   )
   ```

3. **Share Distribution**
   ```python
   total_score = sum(c.score for c in top_collectors)
   for collector in top_collectors:
       collector.share = (collector.score / total_score) * total_share
   ```

### Validation Rules

1. **Total Share**
   - Must not exceed 100%
   - Minimum 0.1% per collector
   - Maximum 50% per collector

2. **Number of Collectors**
   - Minimum: 3 collectors
   - Maximum: 10 collectors
   - Must have non-zero shares

3. **Address Format**
   - Must be valid Tezos addresses (tz1...)
   - Must be unique in the split list

## Integration

### Contract Client

The contract client provides a high-level interface for interacting with the smart contract:

```python
from backend.contracts.interface import OpenEditionContract, Split, MintParams

# Initialize client
contract = OpenEditionContract()

# Prepare splits
splits = [
    Split(address="tz1test1", shares=500),  # 5%
    Split(address="tz1test2", shares=300),  # 3%
    Split(address="tz1test3", shares=200)   # 2%
]

# Create mint parameters
params = MintParams(amount=1, splits=splits)

# Simulate first
result = await contract.mint_with_splits(params, dry_run=True)
print(f"Estimated fee: {result['estimated_fee']}")
print(f"Estimated gas: {result['estimated_gas']}")

# Execute if simulation successful
if result["success"]:
    result = await contract.mint_with_splits(params)
    print(f"Operation hash: {result['operation_hash']}")
```

### Error Handling

The contract client handles common errors:

1. **Simulation Failures**
   - Insufficient balance
   - Invalid parameters
   - Contract paused

2. **Network Errors**
   - Connection timeouts
   - Node unavailable
   - RPC errors

3. **Validation Errors**
   - Invalid addresses
   - Share calculation errors
   - Parameter validation

Example error handling:
```python
try:
    result = await contract.mint_with_splits(params)
    if not result["success"]:
        print(f"Error: {result['error']}")
except Exception as e:
    print(f"Error: {str(e)}")
```

## Transaction Monitoring

The contract client provides transaction monitoring capabilities:

```python
# Monitor transaction status
status = await contract.get_operation_status(operation_hash)
print(f"Status: {status['status']}")
print(f"Confirmations: {status['confirmations']}")

# Wait for confirmations
await contract.wait_for_confirmation(operation_hash, confirmations=3)
```

## Development

### Local Testing

For local testing, use the following configuration:

```python
# Configure environment
os.environ["TEZOS_RPC_URL"] = "https://rpc.tzkt.io/mainnet"
os.environ["OPEN_EDITION_CONTRACT_ADDRESS"] = "KT1test"

# Use test wallet
from pytezos import PyTezosClient
client = PyTezosClient(key="edsk...")
contract = OpenEditionContract(client=client)
```

### Contract Deployment

The contract is already deployed on OBJKT.com. No additional deployment is needed.

## Security

### Best Practices

1. **API Key Management**
   - Never hardcode API keys
   - Use environment variables
   - Rotate keys regularly

2. **Transaction Safety**
   - Always simulate before executing
   - Verify parameters
   - Check operation status

3. **Error Recovery**
   - Implement retry mechanisms
   - Handle network errors
   - Log all operations

## Support

For smart contract support or to report issues:
1. Check the contract status on TzKT
2. Review transaction history
3. Contact OBJKT.com support
4. Open a GitHub issue 