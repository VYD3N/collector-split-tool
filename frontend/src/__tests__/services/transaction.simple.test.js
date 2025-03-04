/**
 * Simple TransactionService test
 */
import { TransactionService } from '../../services/transaction';

// Use Jest's automatic mocking system
jest.mock('@taquito/taquito');
jest.mock('@taquito/beacon-wallet');

describe('TransactionService', () => {
  let transactionService;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance of the service
    transactionService = new TransactionService();
  });
  
  test('initializes correctly', () => {
    expect(transactionService).toBeDefined();
    expect(transactionService.tezos).toBeDefined();
    expect(transactionService.wallet).toBeDefined();
  });
  
  test('connectWallet successfully connects to wallet', async () => {
    // Arrange & Act
    const result = await transactionService.connectWallet();
    
    // Assert
    expect(result).toBeTruthy();
  });
  
  test('sendTransaction successfully sends a transaction', async () => {
    // Arrange
    const contractAddress = 'KT1test';
    const amount = 10;
    const destination = 'tz1test';
    
    // Act
    const result = await transactionService.sendTransaction(contractAddress, amount, destination);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.opHash).toBeDefined();
  });
}); 