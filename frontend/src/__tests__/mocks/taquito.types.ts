import { ContractAbstraction, Wallet, TransactionOperation, OperationStatus, WalletTransferParams, TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { Mock } from 'jest-mock';

// Enums for operation and transaction status
export enum TransactionStatus {
    AWAITING_CONFIRMATION = "awaiting_confirmation",
    SUCCESS = "success",
    ERROR = "error"
}

// Basic mock types
export type MockFn<T> = Mock<Promise<T>>;
export type MockConfirmationFn = Mock<Promise<OperationConfirmation>>;

// Operation confirmation types
export interface BlockInfo {
    hash: string;
    level: number;
}

export interface OperationConfirmation {
    block: BlockInfo;
    currentConfirmation: number;
    expectedConfirmation: number;
    completed: boolean;
    isInCurrentBranch: () => Promise<boolean>;
}

// Base operation result
export interface BaseOperationResult {
    hash: string;
    includedInBlock: number;
    confirmations: number;
    status: "applied" | "failed" | "unknown";
    results: any[];
}

// Mock operation result
export interface MockOperationResult {
    hash: string;
    includedInBlock: number;
    confirmations: number;
    status: "applied" | "failed" | "unknown";
    confirmation: MockConfirmationFn;
    opHash?: string;
    chainId?: string;
    results: any[];
}

// Contract method types
export interface MockContractMethod<T = void> {
    send: MockFn<TransactionOperation>;
    toTransferParams: MockFn<unknown>;
    provider: any;
    address: string;
    parameterSchema: any;
    name: string;
}

// Mock contract type
export interface MockContractAbstraction {
    methods: {
        [key: string]: <T = void>(...args: any[]) => MockContractMethod<T>;
    };
    address: string;
    schema: unknown;
    parameterSchema: unknown;
    script: unknown;
}

// Wallet operation types
export interface WalletOperationResult extends Omit<MockOperationResult, 'opHash' | 'chainId'> {
    opHash: string;
    chainId: string;
}

// Mock account type
export interface MockAccount {
    address: string;
    network: { type: string };
    scopes: string[];
    publicKey: string;
}

// Mock client type
export interface MockBeaconClient {
    getActiveAccount: MockFn<MockAccount | undefined>;
    requestPermissions: MockFn<MockAccount>;
    removeAllAccounts: MockFn<void>;
    getAccounts: MockFn<MockAccount[]>;
}

// Mock wallet type
export interface MockWallet {
    client: MockBeaconClient;
    getPKH: MockFn<string>;
    requestPermissions: MockFn<void>;
    clearActiveAccount: MockFn<void>;
    sendOperation: MockFn<WalletOperationResult>;
    getOperation: MockFn<TransactionOperation>;
}

// Mock wallet methods
export interface MockWalletMethods {
    at: Mock<Promise<MockContractAbstraction>, [string]>;
    transfer: Mock<{ send: () => Promise<WalletOperationResult> }, [WalletTransferParams]>;
    getOperation: MockFn<TransactionOperation>;
}

// Mock Tezos toolkit
export interface MockTezosToolkit {
    wallet: MockWalletMethods;
}

// Contract parameter types
export interface TransferParams {
    to: string;
    amount: number;
    mutez?: boolean;
}

export interface ContractCallParams {
    amount: number;
    fee?: number;
    gasLimit?: number;
    storageLimit?: number;
    mutez?: boolean;
    parameter?: unknown;
} 