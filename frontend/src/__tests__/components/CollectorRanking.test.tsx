/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ChakraProvider } from '@chakra-ui/react';
import { CollectorRanking } from '../../components/CollectorRanking';
import { api } from '../../services/api';
import '../mocks/taquito.setup';

// Mock data
const mockCollectors = [
    {
        address: 'tz1test1',
        total_nfts: 10,
        lifetime_spent: 100.5,
        recent_purchases: 50.25,
        score: 0.85,
        share: 5
    },
    {
        address: 'tz1test2',
        total_nfts: 5,
        lifetime_spent: 50.25,
        recent_purchases: 25.125,
        score: 0.45,
        share: 3
    },
    {
        address: 'tz1test3',
        total_nfts: 15,
        lifetime_spent: 150.75,
        recent_purchases: 75.375,
        score: 0.95,
        share: 7
    }
];

// Mock the API module
jest.mock('../../services/api', () => ({
    api: {
        getCollectors: jest.fn().mockResolvedValue({ collectors: mockCollectors })
    }
}));

jest.mock('@taquito/beacon-wallet');
jest.mock('@taquito/taquito');

describe('CollectorRanking', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                }
            }
        });
        jest.clearAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(
            <ChakraProvider>
                <QueryClientProvider client={queryClient}>
                    <CollectorRanking {...props} />
                </QueryClientProvider>
            </ChakraProvider>
        );
    };

    // 1. Loading State Tests
    describe('Loading State', () => {
        it('shows loading skeletons initially', () => {
            renderComponent();
            expect(screen.getByTestId('loading-skeleton-filters')).toBeInTheDocument();
            expect(screen.getByTestId('loading-skeleton-table')).toBeInTheDocument();
            expect(screen.getByTestId('loading-skeleton-content')).toBeInTheDocument();
        });
    });

    // 2. Empty States Tests
    describe('Empty States', () => {
        it('shows no collectors message when API returns empty array', async () => {
            (api.getCollectors as jest.Mock).mockResolvedValue({ collectors: [] });
            renderComponent();

            await waitFor(() => {
                expect(screen.getByTestId('no-collectors-alert')).toBeInTheDocument();
            });

            const alert = screen.getByTestId('no-collectors-alert');
            expect(within(alert).getByText('No Collectors Found')).toBeInTheDocument();
            expect(within(alert).getByText('There are no collectors for this collection yet.')).toBeInTheDocument();
        });

        it('shows no results message when search filters out all collectors', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const searchInput = screen.getByTestId('address-search-input');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            await waitFor(() => {
                expect(screen.getByTestId('no-results-alert')).toBeInTheDocument();
            });

            const alert = screen.getByTestId('no-results-alert');
            expect(within(alert).getByText('No Results Found')).toBeInTheDocument();
            expect(within(alert).getByText('Try adjusting your search criteria.')).toBeInTheDocument();
        });
    });

    // 3. Filter Controls Tests
    describe('Filter Controls', () => {
        it('filters by address search', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const searchInput = screen.getByTestId('address-search-input');
            fireEvent.change(searchInput, { target: { value: 'test1' } });

            await waitFor(() => {
                const rows = screen.getAllByTestId(/^collector-row-/);
                expect(rows).toHaveLength(1);
            });

            expect(screen.getByText('tz1test1')).toBeInTheDocument();
            expect(screen.queryByText('tz1test2')).not.toBeInTheDocument();
        });

        it('filters by minimum NFTs', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const nftInput = screen.getByTestId('min-nfts-input');
            fireEvent.change(screen.getByRole('spinbutton', { name: /minimum nfts/i }), { target: { value: '10' } });

            await waitFor(() => {
                const rows = screen.getAllByTestId(/^collector-row-/);
                expect(rows).toHaveLength(2);
            });
        });
    });

    // 4. Sorting Tests
    describe('Sorting Behavior', () => {
        it('shows sort indicators in column headers', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const scoreHeader = screen.getByTestId('score-header');
            expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');
            expect(within(scoreHeader).getByTestId('sort-icon-score-desc')).toBeInTheDocument();
        });

        it('toggles sort direction when clicking same column', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const scoreHeader = screen.getByTestId('score-header');
            fireEvent.click(scoreHeader);

            await waitFor(() => {
                expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');
            });

            expect(within(scoreHeader).getByTestId('sort-icon-score-asc')).toBeInTheDocument();
        });

        it('sorts addresses correctly', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const addressHeader = screen.getByTestId('address-header');
            fireEvent.click(addressHeader);

            // Wait for first row
            await waitFor(() => {
                expect(screen.getByTestId('collector-row-0')).toHaveTextContent('tz1test1');
            });

            // Check remaining rows
            expect(screen.getByTestId('collector-row-1')).toHaveTextContent('tz1test2');
            expect(screen.getByTestId('collector-row-2')).toHaveTextContent('tz1test3');
        });
    });

    // 5. Selection Tests
    describe('Selection Behavior', () => {
        it('updates selected collectors stats when selecting rows', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const rows = screen.getAllByTestId(/^collector-row-/);
            fireEvent.click(rows[0]);
            fireEvent.click(rows[1]);

            await waitFor(() => {
                expect(screen.getByTestId('selected-collectors-stats')).toBeInTheDocument();
            });

            expect(screen.getByTestId('selected-total-nfts')).toHaveTextContent('15');
            expect(screen.getByTestId('selected-total-spent')).toHaveTextContent('150.75 ꜩ');
            expect(screen.getByTestId('selected-average-score')).toHaveTextContent('0.65');
        });

        it('highlights selected rows', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByTestId('collectors-table-card')).toBeInTheDocument();
            });

            const firstRow = screen.getByTestId('collector-row-0');
            fireEvent.click(firstRow);

            expect(firstRow).toHaveStyle({ backgroundColor: 'var(--chakra-colors-gray-50)' });
            expect(firstRow).toHaveAttribute('aria-selected', 'true');
        });
    });

    // 6. Error Handling Tests
    describe('Error Handling', () => {
        it('shows error alert and retry button when API fails', async () => {
            const errorMessage = 'Failed to fetch';
            (api.getCollectors as jest.Mock).mockRejectedValue(new Error(errorMessage));
            renderComponent();

            await waitFor(() => {
                expect(screen.getByTestId('error-alert')).toBeInTheDocument();
            });

            const alert = screen.getByTestId('error-alert');
            expect(within(alert).getByText('Error Loading Collectors')).toBeInTheDocument();
            expect(within(alert).getByText(errorMessage)).toBeInTheDocument();

            const retryButton = screen.getByTestId('retry-button');
            fireEvent.click(retryButton);
            expect(api.getCollectors).toHaveBeenCalledTimes(2);
        });
    });

    it('renders without crashing', () => {
        render(
            <ChakraProvider>
                <CollectorRanking />
            </ChakraProvider>
        );
        expect(screen.getByText(/Collector Ranking/i)).toBeInTheDocument();
    });
}); 