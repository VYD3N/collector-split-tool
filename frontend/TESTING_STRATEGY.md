# Testing Strategy for Collector Split Tool
This document outlines our approach to testing the Collector Split Tool application, with special consideration for the challenges of testing blockchain interactions.

## Testing Challenges

Testing blockchain applications presents several unique challenges:

1. **External dependencies**: Interactions with the Tezos blockchain require external services
2. **State changes**: Blockchain operations mutate global state in unpredictable ways
3. **Asynchronous operations**: Transactions require confirmation, which can take time
4. **Wallet integration**: User wallet interactions are hard to automate in tests
5. **Complex mocking**: Tezos libraries have intricate types and deep dependency trees

## Testing Approach

We adopt a layered testing approach that focuses on each component's specific requirements:

### 1. Unit Tests

**Target**: Individual functions, utilities, and UI components  
**Tools**: Jest, React Testing Library  
**Approach**:
- Test pure functions completely
- Mock external dependencies
- Use simplified test helper modules instead of complex mocks
- Avoid testing Tezos-specific functionality directly

**Examples**:
- Testing the `formatAddress` function in `utils/formatting.ts`
- Testing the `ApiService` class with mocked HTTP responses
- Testing UI components that don't interact with the blockchain
- Testing the `prepareSplits` function in the contract service

### 2. Integration Tests

**Target**: Service abstractions and their coordination  
**Tools**: Jest with simplified mock implementations  
**Approach**:
- Create simplified mock implementations of interfaces
- Test workflows that use multiple services
- Focus on proper handling of success/error states

**Examples**:
- Testing that the `ContractService` correctly uses the connected wallet service
- Testing that UI components correctly display API data
- Testing that error handling propagates correctly through service abstractions

### 3. Contract Testing

**Target**: Smart contract interactions  
**Tools**: Manual testing and simulation  
**Approach**:
- Test contract simulations during development (`dryRun: true`)
- Create scripts to automate common test scenarios
- Document test procedures for repeatable execution

**Examples**:
- Testing mint operation with splits using `dryRun: true`
- Verifying operation parameters match expected contract inputs
- Testing operation fee and gas estimates

### 4. End-to-End Tests

**Target**: Complete application workflows  
**Tools**: Manual/scripted testing on testnet  
**Approach**:
- Test on Tezos testnet/ghostnet before mainnet
- Create test accounts and document configurations
- Verify transaction monitoring works correctly

**Examples**:
- Complete mint process with wallet connection, collector selection, and split distribution
- Testing error scenarios like wallet disconnection during a transaction
- Testing transaction monitoring and confirmation UI

## Mock Strategy

Given the difficulties with Jest and Tezos library mocking, we take the following approach:

1. **Service Interfaces**: Define clear interfaces for all services (`IWalletService`, `IApiService`, etc.)
2. **Simple Implementations**: Create simple test implementations that don't use external libraries
3. **Dependency Injection**: Use constructors or factories to allow easy service replacement
4. **Manual Mocks**: Use Jest's manual mock system (`__mocks__` directory) for problematic modules
5. **JS-Based Testing**: Use JavaScript instead of TypeScript for test files with complex mocking

### Example Mock Implementation

```typescript
// TestWalletService.ts - Simple mock for testing
export class TestWalletService implements IWalletService {
  private connected = false;
  private address = "tz1test";
  
  async connectWallet(): Promise<WalletInfo> {
    this.connected = true;
    return {
      address: this.address,
      connected: true,
      network: "testnet"
    };
  }
  
  async disconnectWallet(): Promise<void> {
    this.connected = false;
  }
  
  // ... implement other methods with test behavior
}
```

## Test Data Management

For consistent and repeatable tests:

1. **Test fixtures**: Create fixture data for common test scenarios
   ```typescript
   // fixtures/collectors.ts
   export const mockCollectors = [
     {
       address: "tz1test1",
       total_nfts: 10,
       lifetime_spent: 100.5,
       recent_purchases: 50.25,
       score: 0.85
     },
     // ...more collectors
   ];
   ```

2. **Deterministic addresses**: Use consistent test wallet addresses
   ```typescript
   export const TEST_ADDRESSES = {
     WALLET: "tz1test",
     CONTRACT: "KT1test",
     COLLECTORS: ["tz1test1", "tz1test2", "tz1test3"]
   };
   ```

3. **Configuration**: Document specific testnet contracts to use
   ```typescript
   export const TEST_CONFIG = {
     RPC_URL: "https://ghostnet.tezos.marigold.dev",
     CONTRACTS: {
       OPEN_EDITION: "KT1..."
     }
   };
   ```

## Testnet Environment

We use the Tezos ghostnet (testnet) for testing blockchain interactions:

1. **Setup**:
   - Use a dedicated test wallet with test tez
   - Deploy test contracts with known configurations
   - Document RPC endpoints and contract addresses

2. **Automation**:
   - Create scripts to reset test environment
   - Provide test account credentials for CI/CD
   - Document steps to reproduce test scenarios

3. **Testing Process**:
   - Test all flows on ghostnet before release
   - Verify contract interactions work as expected
   - Document known limitations or differences from mainnet

## Practical Guidelines

When writing tests:

1. **Simplify tests**: Don't try to test blockchain functionality directly, test your interface to it
2. **Focus on boundaries**: Test how your code handles different responses from the blockchain
3. **Test error handling**: Ensure your application correctly handles failures at each layer
4. **Skip problematic tests**: Mark tests as skipped (`test.skip`) rather than having failing builds
5. **Document limitations**: Be clear about what aspects are and aren't covered by automated tests
6. **Isolate external dependencies**: Use dependency injection to replace external services in tests
7. **Test behavior, not implementation**: Test what functions do, not how they do it

## Manual Testing

Some aspects of the application will require manual testing:

1. **Wallet connection flows**:
   - First-time connection
   - Network switching
   - Reconnection after disconnection
   - Permissions management

2. **Transaction submission and confirmation**:
   - Transaction fee estimation
   - Monitoring confirmation progress
   - Handling network congestion
   - Displaying confirmation results

3. **Error scenarios**:
   - Network failures
   - Contract errors
   - User rejection of operations
   - Timeout handling

Document these manual test procedures clearly so they can be consistently executed.

## CI/CD Considerations

For continuous integration:

1. **Unit/Integration Tests**: Run on every PR
2. **Environment Variables**: Use separate env files for test/production
3. **Skip Blockchain Tests**: Use conditionals to skip tests requiring blockchain in CI
4. **Test Reporting**: Generate coverage and test reports
5. **Testnet Deployment**: Deploy to ghostnet with automated E2E tests

## Documentation

Maintain comprehensive testing documentation:

1. **Service API Documentation**: Document each service interface clearly
2. **Test Coverage Reports**: Generate and review coverage metrics
3. **Testing Guides**: Document how to run tests and add new tests
4. **Testnet Guide**: Provide instructions for testnet testing
5. **Known Limitations**: Document what aspects can't be fully automated
