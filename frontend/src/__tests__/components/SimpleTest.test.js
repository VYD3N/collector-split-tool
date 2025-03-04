import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders, setupTezosToolkitMock, setupBeaconWalletMock } from '../utils/test-helpers';
import { CollectorRanking } from '../../components/CollectorRanking';

// Setup mocks
jest.mock('../../services/api', () => ({
  api: {
    getCollectors: jest.fn().mockResolvedValue({
      collectors: [
        {
          address: 'tz1test1',
          total_nfts: 10,
          lifetime_spent: 100.5,
          recent_purchases: 50.25,
          score: 0.85
        }
      ]
    })
  }
}));

// Mock Taquito modules by using Jest manual mocks
// The actual implementation is in __mocks__/@taquito/taquito.js and __mocks__/@taquito/beacon-wallet.js
jest.mock('@taquito/taquito');
jest.mock('@taquito/beacon-wallet');

describe('Basic Component Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTezosToolkitMock();
    setupBeaconWalletMock();
  });

  it('renders CollectorRanking without crashing', () => {
    renderWithProviders(<CollectorRanking />);
    
    // Check that loading state is initially shown
    const loadingElement = screen.getByTestId('loading-skeleton-table');
    expect(loadingElement).toBeInTheDocument();
  });
}); 