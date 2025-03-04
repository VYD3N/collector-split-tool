import { jest } from '@jest/globals';
import { Origin } from '@airgap/beacon-sdk';

// Create simple mock functions that don't rely on typing
const mockSetWalletProvider = jest.fn();
const mockAt = jest.fn();
const mockTransfer = jest.fn();
const mockGetOperation = jest.fn();
const mockGetActiveAccount = jest.fn();
const mockRequestPermissions = jest.fn();
const mockRemoveAllAccounts = jest.fn();
const mockGetPKH = jest.fn();

// Create mock account data
const mockAccountData = {
  accountIdentifier: 'test_account',
  senderId: 'test_sender',
  origin: Origin.EXTENSION,
  address: 'tz1test',
  network: {
    type: 'mainnet'
  },
  scopes: ['operation_request'],
  publicKey: 'test_public_key',
  connectedAt: new Date().getTime(),
  walletType: 'implicit'
};

// Mock operation data
const mockOperationData = {
  hash: 'op_hash_test',
  opHash: 'op_hash_test',
  confirmation: jest.fn().mockResolvedValue({
    block: { hash: 'block_hash', level: 100 },
    currentConfirmation: 1,
    expectedConfirmation: 1,
    completed: true,
    isInCurrentBranch: jest.fn().mockResolvedValue(true)
  })
};

// Mock Taquito - simplified to avoid type issues
jest.mock('@taquito/taquito', () => {
  return {
    TezosToolkit: jest.fn().mockImplementation(() => ({
      setWalletProvider: mockSetWalletProvider,
      wallet: {
        at: jest.fn().mockResolvedValue({
          methods: {
            transfer: jest.fn().mockImplementation(() => ({
              send: jest.fn().mockResolvedValue(mockOperationData)
            })),
            mint: jest.fn().mockImplementation(() => ({
              send: jest.fn().mockResolvedValue(mockOperationData)
            }))
          },
          address: 'KT1test'
        }),
        transfer: jest.fn().mockImplementation(() => ({
          send: jest.fn().mockResolvedValue(mockOperationData)
        })),
        getOperation: jest.fn().mockResolvedValue(mockOperationData)
      }
    }))
  };
});

// Mock Beacon Wallet
jest.mock('@taquito/beacon-wallet', () => {
  return {
    BeaconWallet: jest.fn().mockImplementation(() => ({
      client: {
        getActiveAccount: jest.fn().mockResolvedValue(mockAccountData),
        requestPermissions: jest.fn().mockResolvedValue(mockAccountData),
        removeAllAccounts: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined)
      },
      getPKH: jest.fn().mockResolvedValue('tz1test'),
      requestSignPayload: jest.fn().mockResolvedValue({
        signature: 'test_signature',
        signingType: 'micheline',
        payload: 'test_payload'
      }),
      sendOperations: jest.fn().mockResolvedValue({
        opHash: 'test_operation_hash',
        includedInBlock: 123456
      })
    }))
  };
});

export {
  mockSetWalletProvider,
  mockAt,
  mockTransfer,
  mockGetOperation,
  mockGetActiveAccount,
  mockRequestPermissions,
  mockRemoveAllAccounts,
  mockGetPKH,
  mockAccountData,
  mockOperationData
};