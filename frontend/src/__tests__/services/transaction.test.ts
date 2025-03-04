import { jest } from '@jest/globals';
import { TezosToolkit, TransactionOperation } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { TransactionService, TransactionStatus } from "../../services/transaction";
import {
    createMockTezos,
    createMockWallet,
    createMockOperation,
    OperationConfirmation
} from "../mocks/taquito.mocks";

// Mock Taquito classes and interfaces
jest.mock("@taquito/taquito");
jest.mock("@taquito/beacon-wallet");

describe("TransactionService", () => {
    let transactionService: TransactionService;
    let mockTezos: jest.Mocked<TezosToolkit>;
    let mockWallet: jest.Mocked<BeaconWallet>;
    let mockOperation: jest.Mocked<TransactionOperation>;

    beforeEach(() => {
        jest.useFakeTimers();

        // Create mock instances using factories
        mockTezos = createMockTezos();
        mockWallet = createMockWallet();
        mockOperation = createMockOperation("op_hash_1");

        // Update mock wallet operations to use our test operation
        mockTezos.wallet.at.mockImplementation(() => Promise.resolve({
            methods: {
                transfer: () => ({
                    send: jest.fn().mockResolvedValue(mockOperation)
                })
            }
        }));

        transactionService = new TransactionService(mockTezos, mockWallet);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe("Basic Transaction Execution", () => {
        it("should successfully send and confirm a transaction", async () => {
            // Mock successful confirmations
            mockOperation.confirmation
                .mockResolvedValueOnce({
                    block: { hash: "block1", level: 100 },
                    currentConfirmation: 1,
                    expectedConfirmation: 1,
                    completed: false,
                    isInCurrentBranch: async () => true
                })
                .mockResolvedValueOnce({
                    block: { hash: "block2", level: 101 },
                    currentConfirmation: 2,
                    expectedConfirmation: 2,
                    completed: false,
                    isInCurrentBranch: async () => true
                })
                .mockResolvedValueOnce({
                    block: { hash: "block3", level: 102 },
                    currentConfirmation: 3,
                    expectedConfirmation: 3,
                    completed: true,
                    isInCurrentBranch: async () => true
                });

            const result = await transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"]
            );

            expect(result.success).toBe(true);
            expect(mockTezos.wallet.at).toHaveBeenCalled();
            expect(mockOperation.confirmation).toHaveBeenCalledTimes(3);
        }, 30000);

        it("should handle transaction errors gracefully", async () => {
            mockTezos.wallet.at.mockRejectedValue(new Error("Invalid contract"));

            const result = await transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"]
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Invalid contract");
        });
    });

    describe("Transaction Timeout Handling", () => {
        it("should timeout after 60 seconds", async () => {
            // Mock a never-resolving confirmation
            mockOperation.confirmation.mockImplementation(() => 
                new Promise(() => {/* never resolves */})
            );

            // Start the transaction but don't await it yet
            const resultPromise = transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"]
            );

            // Advance timers by 61 seconds
            await jest.advanceTimersByTimeAsync(61000);

            // Now await the result - it should have timed out
            const result = await resultPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe("Transaction timed out after 60 seconds");
        }, 70000);
    });

    describe("Real-Time Frontend Updates", () => {
        it("should properly send status updates to listeners", async () => {
            const statusUpdates: TransactionStatus[] = [];
            const onStatusUpdate = (status: TransactionStatus) => {
                statusUpdates.push(status);
            };

            mockOperation.confirmation
                .mockResolvedValueOnce({
                    block: { hash: "block1", level: 100 },
                    currentConfirmation: 1,
                    expectedConfirmation: 1,
                    completed: false,
                    isInCurrentBranch: async () => true
                })
                .mockResolvedValueOnce({
                    block: { hash: "block2", level: 101 },
                    currentConfirmation: 2,
                    expectedConfirmation: 2,
                    completed: false,
                    isInCurrentBranch: async () => true
                })
                .mockResolvedValueOnce({
                    block: { hash: "block3", level: 102 },
                    currentConfirmation: 3,
                    expectedConfirmation: 3,
                    completed: true,
                    isInCurrentBranch: async () => true
                });

            const result = await transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"],
                onStatusUpdate
            );

            expect(result.success).toBe(true);
            expect(statusUpdates).toHaveLength(4);
            expect(statusUpdates[0].status).toBe("pending");
            expect(statusUpdates[3].status).toBe("confirmed");
        }, 30000);
    });

    describe("Edge Cases", () => {
        it("should handle network disconnections", async () => {
            mockOperation.confirmation.mockRejectedValue(
                new Error("Network error")
            );

            const result = await transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"]
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Network error");
        });

        it("should handle invalid contract parameters", async () => {
            mockTezos.wallet.at.mockRejectedValue(
                new Error("Invalid contract")
            );

            const result = await transactionService.sendTransaction(
                "invalid_address",
                "transfer",
                ["param1"]
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Invalid contract");
        });

        it("should handle confirmation delays", async () => {
            const confirmations: OperationConfirmation[] = [
                {
                    block: { hash: "block1", level: 100 },
                    currentConfirmation: 1,
                    expectedConfirmation: 1,
                    completed: false,
                    isInCurrentBranch: async () => true
                },
                {
                    block: { hash: "block2", level: 101 },
                    currentConfirmation: 2,
                    expectedConfirmation: 2,
                    completed: false,
                    isInCurrentBranch: async () => true
                },
                {
                    block: { hash: "block3", level: 102 },
                    currentConfirmation: 3,
                    expectedConfirmation: 3,
                    completed: true,
                    isInCurrentBranch: async () => true
                }
            ];

            mockOperation.confirmation
                .mockImplementationOnce(() => Promise.resolve(confirmations[0]))
                .mockImplementationOnce(() => Promise.resolve(confirmations[1]))
                .mockImplementationOnce(() => Promise.resolve(confirmations[2]));

            const onStatusUpdate = jest.fn();

            const result = await transactionService.sendTransaction(
                "KT1test",
                "transfer",
                ["param1"],
                onStatusUpdate
            );

            await jest.runAllTimers();
            await Promise.resolve();

            expect(result.success).toBe(true);
            expect(result.confirmations).toBe(3);
            expect(onStatusUpdate).toHaveBeenCalledTimes(4);
            expect(onStatusUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
                status: "confirmed",
                confirmations: 3
            }));
        }, 30000);
    });
}); 