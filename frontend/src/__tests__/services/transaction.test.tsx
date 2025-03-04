import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { TransactionService } from '../../services/transaction';
import { MockTezosToolkit, MockWallet } from '../mocks/taquito.mocks';

// Use legacy timers
jest.useFakeTimers({ legacyFakeTimers: true });

describe('TransactionService', () => {
    let tezos: jest.Mocked<TezosToolkit>;
    let wallet: jest.Mocked<BeaconWallet>;
    let transactionService: TransactionService;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Create mock instances
        tezos = new MockTezosToolkit() as jest.Mocked<TezosToolkit>;
        wallet = new MockWallet() as jest.Mocked<BeaconWallet>;
        
        // Initialize service with mocks
        transactionService = new TransactionService(tezos, wallet);
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    it('should send transaction and confirm it', async () => {
        const contractAddress = 'KT1test';
        const entrypoint = 'transfer';
        const parameters = { to: 'tz1test', amount: 100 };
        
        const mockOpHash = 'test_operation_hash';
        const mockConfirmation = { hash: mockOpHash, includedInBlock: 1234 };
        
        // Mock contract method call
        const mockContractMethod = {
            send: jest.fn().mockResolvedValue({
                hash: mockOpHash,
                confirmation: jest.fn().mockResolvedValue(mockConfirmation)
            })
        };
        
        const mockContract = {
            methods: {
                [entrypoint]: jest.fn().mockReturnValue(mockContractMethod)
            }
        };
        
        tezos.wallet.at.mockResolvedValue(mockContract as any);
        
        const result = await transactionService.sendTransaction(contractAddress, entrypoint, parameters);
        
        expect(result).toBeDefined();
        expect(result.hash).toBe(mockOpHash);
        expect(tezos.wallet.at).toHaveBeenCalledWith(contractAddress);
        expect(mockContractMethod.send).toHaveBeenCalled();
    });

    it('should handle transaction error', async () => {
        const contractAddress = 'KT1invalid';
        const entrypoint = 'transfer';
        const parameters = { to: 'tz1test', amount: 100 };
        
        tezos.wallet.at.mockRejectedValue(new Error('Invalid contract'));
        
        await expect(
            transactionService.sendTransaction(contractAddress, entrypoint, parameters)
        ).rejects.toThrow('Invalid contract');
    });

    it('should timeout after 60 seconds if confirmation never resolves', async () => {
        const contractAddress = 'KT1test';
        const entrypoint = 'transfer';
        const parameters = { to: 'tz1test', amount: 100 };
        
        const mockOpHash = 'test_operation_hash';
        
        // Mock contract method that never confirms
        const mockContractMethod = {
            send: jest.fn().mockResolvedValue({
                hash: mockOpHash,
                confirmation: jest.fn().mockImplementation(() => new Promise(() => {}))
            })
        };
        
        const mockContract = {
            methods: {
                [entrypoint]: jest.fn().mockReturnValue(mockContractMethod)
            }
        };
        
        tezos.wallet.at.mockResolvedValue(mockContract as any);
        
        const promise = transactionService.sendTransaction(contractAddress, entrypoint, parameters);
        
        // Advance timers by 61 seconds
        jest.advanceTimersByTime(61000);
        
        await expect(promise).rejects.toThrow('Transaction confirmation timeout');
    });
}); 