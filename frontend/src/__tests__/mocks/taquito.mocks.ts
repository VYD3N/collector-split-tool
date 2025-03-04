import { jest } from '@jest/globals';
import { TezosToolkit, TransactionOperation, WalletTransferParams } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import type { Mock } from 'jest-mock';
import { 
    OperationConfirmation,
    MockContractAbstraction,
    MockWallet,
    WalletOperationResult,
    MockAccount,
    MockBeaconClient,
    MockFn,
    MockConfirmationFn,
    MockOperationResult,
    MockTezosToolkit,
    MockWalletMethods,
    MockContractMethod
} from './taquito.types';

// Mock Taquito modules
jest.mock('@taquito/taquito', () => ({
    TezosToolkit: jest.fn().mockImplementation(() => ({
        setWalletProvider: jest.fn(),
        wallet: {
            at: jest.fn(),
            transfer: jest.fn(),
            getOperation: jest.fn()
        }
    }))
}));

jest.mock('@taquito/beacon-wallet', () => ({
    BeaconWallet: jest.fn().mockImplementation(() => ({
        client: {
            getActiveAccount: jest.fn(),
            requestPermissions: jest.fn(),
            removeAllAccounts: jest.fn(),
            getAccounts: jest.fn()
        },
        getPKH: jest.fn(),
        requestPermissions: jest.fn(),
        clearActiveAccount: jest.fn(),
        sendOperation: jest.fn(),
        getOperation: jest.fn()
    }))
}));

// Type-safe mock function creator
function createMockFn<T>(): MockFn<T> {
    return jest.fn() as MockFn<T>;
}

// Create mock confirmation function
function createMockConfirmation(): MockConfirmationFn {
    return jest.fn((confirmations: number = 1) => 
        Promise.resolve({
            block: { hash: "block_hash", level: 100 },
            currentConfirmation: confirmations,
            expectedConfirmation: confirmations,
            completed: confirmations >= 3,
            isInCurrentBranch: async () => true
        })
    ) as MockConfirmationFn;
}

// Create mock beacon client
export function createMockBeaconClient(): MockBeaconClient {
    const mockAccount: MockAccount = {
        address: "tz1test",
        network: { type: "mainnet" },
        scopes: ["operation_request"],
        publicKey: "test_public_key"
    };

    return {
        getActiveAccount: createMockFn<MockAccount>().mockResolvedValue(mockAccount),
        requestPermissions: createMockFn<MockAccount>().mockResolvedValue(mockAccount),
        removeAllAccounts: createMockFn<void>().mockResolvedValue(),
        getAccounts: createMockFn<MockAccount[]>().mockResolvedValue([mockAccount])
    };
}

// Mock operation factory
export function createMockOperation(hash: string = "op_hash"): MockOperationResult {
    const confirmation = createMockConfirmation();
    const operation: MockOperationResult = {
        hash,
        opHash: hash,
        includedInBlock: 0,
        confirmations: 0,
        status: "applied",
        confirmation,
        results: [],
        chainId: "NetXdQprcVkpaWU"
    } as MockOperationResult;
    return operation;
}

// Mock wallet operation factory
export function createMockWalletOperation(): WalletOperationResult {
    const mockOp = createMockOperation();
    return {
        ...mockOp,
        opHash: mockOp.hash,
        chainId: "NetXdQprcVkpaWU"
    };
}

// Mock contract factory
export function createMockContract(): MockContractAbstraction {
    const mockContract: MockContractAbstraction = {
        address: "KT1test",
        schema: {},
        parameterSchema: {},
        script: {},
        methods: {
            transfer: <T = void>(...args: any[]): MockContractMethod<T> => ({
                send: createMockFn<TransactionOperation>()
                    .mockResolvedValue(createMockOperation() as unknown as TransactionOperation),
                toTransferParams: createMockFn<unknown>().mockResolvedValue({}),
                provider: {},
                address: "KT1test",
                parameterSchema: {},
                name: "transfer"
            })
        }
    };
    return mockContract;
}

// Mock wallet factory
export function createMockWallet(): MockWallet {
    return {
        client: createMockBeaconClient(),
        getPKH: createMockFn<string>().mockResolvedValue("tz1test"),
        requestPermissions: createMockFn<void>().mockResolvedValue(),
        clearActiveAccount: createMockFn<void>().mockResolvedValue(),
        sendOperation: createMockFn<WalletOperationResult>()
            .mockResolvedValue(createMockWalletOperation()),
        getOperation: createMockFn<TransactionOperation>()
            .mockResolvedValue(createMockOperation() as unknown as TransactionOperation)
    };
}

// Create mock wallet methods
function createMockWalletMethods(): MockWalletMethods {
    const mockWalletOp = createMockWalletOperation();
    const mockContract = createMockContract();

    const atMock = jest.fn() as Mock<Promise<MockContractAbstraction>, [string]>;
    atMock.mockImplementation(async (address: string) => {
        mockContract.address = address;
        return mockContract;
    });

    const transferMock = jest.fn() as Mock<{ send: () => Promise<WalletOperationResult> }, [WalletTransferParams]>;
    transferMock.mockImplementation((params: WalletTransferParams) => ({
        send: async () => mockWalletOp
    }));

    return {
        at: atMock,
        transfer: transferMock,
        getOperation: createMockFn<TransactionOperation>()
            .mockResolvedValue(createMockOperation() as unknown as TransactionOperation)
    };
}

// Mock Tezos toolkit factory
export function createMockTezos(): MockTezosToolkit {
    return {
        wallet: createMockWalletMethods()
    };
} 