import { jest } from '@jest/globals';

// Create mock account data
const mockAccount = {
    accountIdentifier: 'test_account',
    senderId: 'test_sender',
    origin: {
        type: 'extension',
        id: 'test_origin'
    },
    address: 'tz1test',
    network: {
        type: 'mainnet'
    },
    scopes: ['operation_request'],
    publicKey: 'test_public_key',
    connectedAt: new Date().getTime(),
    walletType: 'implicit'
};

// Create simple mock functions
const mockGetActiveAccount = jest.fn().mockResolvedValue(mockAccount);
const mockRequestPermissions = jest.fn().mockResolvedValue(mockAccount);
const mockRemoveAllAccounts = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockGetPKH = jest.fn().mockResolvedValue('tz1test');
const mockRequestSignPayload = jest.fn().mockResolvedValue({
    signature: 'test_signature',
    signingType: 'micheline',
    payload: 'test_payload'
});
const mockSendOperations = jest.fn().mockResolvedValue({
    opHash: 'test_operation_hash',
    includedInBlock: 123456
});

// Mock Beacon Wallet
jest.mock('@taquito/beacon-wallet', () => {
    // Create the mock class constructor
    const BeaconWallet = jest.fn().mockImplementation(() => ({
        client: {
            getActiveAccount: mockGetActiveAccount,
            requestPermissions: mockRequestPermissions,
            removeAllAccounts: mockRemoveAllAccounts,
            disconnect: mockDisconnect
        },
        getPKH: mockGetPKH,
        requestSignPayload: mockRequestSignPayload,
        sendOperations: mockSendOperations
    }));
    
    // Return the mocked constructor
    return { BeaconWallet };
});

// Export the mocks for use in tests
export {
    mockAccount,
    mockGetActiveAccount,
    mockRequestPermissions,
    mockRemoveAllAccounts,
    mockDisconnect,
    mockGetPKH,
    mockRequestSignPayload,
    mockSendOperations
}; 