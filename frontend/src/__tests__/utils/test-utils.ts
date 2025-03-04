import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';

// Create a fresh QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
      staleTime: 0
    }
  }
});

// Custom render with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  const Wrapper = ({ children }: {children: React.ReactNode}) => {
    return (
      <ChakraProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ChakraProvider>
    );
  };
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Tezos mock data
export const mockTezosAccount = {
  address: 'tz1testAddress',
  publicKey: 'test_public_key',
  network: { type: 'mainnet' },
  scopes: ['operation_request'],
  walletType: 'implicit'
};

export const mockOperationHash = 'op_test_hash';

// Create mock operation data
export const createMockOperation = (hash: string = mockOperationHash) => ({
  hash,
  opHash: hash,
  includedInBlock: 123456,
  confirmations: 2,
  status: 'applied',
  confirmation: jest.fn().mockResolvedValue({
    block: { hash: 'block_hash', level: 100 },
    currentConfirmation: 2,
    expectedConfirmation: 3,
    completed: false,
    isInCurrentBranch: async () => true
  })
});

// Setup TezosToolkit mock
export function setupTezosToolkitMock() {
  const mockOperation = createMockOperation();
  
  const mockWalletContract = {
    methods: {
      transfer: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue(mockOperation)
      }),
      mint: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue(mockOperation)
      })
    },
    address: 'KT1testContractAddress'
  };
  
  const mockTezos = {
    setWalletProvider: jest.fn(),
    wallet: {
      at: jest.fn().mockResolvedValue(mockWalletContract),
      transfer: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue(mockOperation)
      }),
      getOperation: jest.fn().mockResolvedValue(mockOperation)
    }
  };
  
  jest.spyOn(TezosToolkit.prototype, 'setWalletProvider').mockImplementation(mockTezos.setWalletProvider);
  Object.defineProperty(TezosToolkit.prototype, 'wallet', { value: mockTezos.wallet });
  
  return mockTezos;
}

// Setup BeaconWallet mock
export function setupBeaconWalletMock(connected: boolean = true) {
  const mockWallet = {
    client: {
      getActiveAccount: jest.fn().mockResolvedValue(connected ? mockTezosAccount : null),
      requestPermissions: jest.fn().mockResolvedValue(mockTezosAccount),
      removeAllAccounts: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined)
    },
    getPKH: jest.fn().mockResolvedValue(mockTezosAccount.address),
    clearActiveAccount: jest.fn().mockResolvedValue(undefined),
    requestSignPayload: jest.fn().mockResolvedValue({
      signature: 'test_signature',
      signingType: 'micheline',
      payload: 'test_payload'
    }),
    sendOperations: jest.fn().mockResolvedValue({
      opHash: mockOperationHash,
      includedInBlock: 123456
    })
  };
  
  jest.spyOn(BeaconWallet.prototype, 'getPKH').mockImplementation(mockWallet.getPKH);
  jest.spyOn(BeaconWallet.prototype, 'clearActiveAccount').mockImplementation(mockWallet.clearActiveAccount);
  
  // Mock the client property
  Object.defineProperty(BeaconWallet.prototype, 'client', { value: mockWallet.client });
  
  return mockWallet;
}

// Utility for API mocks
export function setupApiMocks(customMocks = {}) {
  const defaultMocks = {
    getCollectors: jest.fn().mockResolvedValue({
      collectors: [
        {
          address: 'tz1test1',
          total_nfts: 10,
          lifetime_spent: 100.5,
          recent_purchases: 50.25,
          score: 0.85
        },
        {
          address: 'tz1test2',
          total_nfts: 5,
          lifetime_spent: 50.25,
          recent_purchases: 20.0,
          score: 0.65
        }
      ]
    })
  };
  
  const apiMocks = { ...defaultMocks, ...customMocks };
  
  jest.mock('../../services/api', () => ({
    api: apiMocks
  }), { virtual: true });
  
  return apiMocks;
}

// Helper to wait for promises to resolve
export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Re-export everything from testing-library
export * from '@testing-library/react'; 