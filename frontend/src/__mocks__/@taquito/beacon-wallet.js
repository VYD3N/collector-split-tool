// Create mock account data
const mockAccountData = {
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
const mockGetActiveAccount = jest.fn().mockResolvedValue(mockAccountData);
const mockRequestPermissions = jest.fn().mockResolvedValue(mockAccountData);
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

class BeaconWallet {
  constructor() {
    this.client = {
      getActiveAccount: mockGetActiveAccount,
      requestPermissions: mockRequestPermissions,
      removeAllAccounts: mockRemoveAllAccounts,
      disconnect: mockDisconnect
    };
    this.getPKH = mockGetPKH;
    this.requestSignPayload = mockRequestSignPayload;
    this.sendOperations = mockSendOperations;
  }
}

module.exports = {
  BeaconWallet,
  mockAccountData,
  mockGetActiveAccount,
  mockRequestPermissions,
  mockRemoveAllAccounts,
  mockDisconnect,
  mockGetPKH,
  mockRequestSignPayload,
  mockSendOperations
}; 