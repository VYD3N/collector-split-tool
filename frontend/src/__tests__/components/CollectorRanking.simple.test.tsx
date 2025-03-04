/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ChakraProvider } from '@chakra-ui/react';
import { CollectorRanking } from '../../components/CollectorRanking';
import { api } from '../../services/api';
import '../mocks/taquito.setup';

// Mock the API module
jest.mock('../../services/api', () => ({
    api: {
        getCollectors: jest.fn().mockResolvedValue({ collectors: [] })
    }
}));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        }
    }
});

describe('CollectorRanking - Simple Tests', () => {
    it('shows loading state initially', () => {
        render(
            <ChakraProvider>
                <QueryClientProvider client={queryClient}>
                    <CollectorRanking />
                </QueryClientProvider>
            </ChakraProvider>
        );
        
        expect(screen.getByTestId('loading-skeleton-filters')).toBeInTheDocument();
    });
}); 