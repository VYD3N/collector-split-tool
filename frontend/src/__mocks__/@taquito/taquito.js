// Mock TezosToolkit
const mockSetWalletProvider = jest.fn();
const mockAt = jest.fn();
const mockTransfer = jest.fn();
const mockGetOperation = jest.fn();

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

const mockWallet = {
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
};

class TezosToolkit {
  constructor() {
    this.setWalletProvider = mockSetWalletProvider;
    this.wallet = mockWallet;
  }
}

module.exports = {
  TezosToolkit,
  mockSetWalletProvider,
  mockAt,
  mockTransfer,
  mockGetOperation,
  mockOperationData
}; 