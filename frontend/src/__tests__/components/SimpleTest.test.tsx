import React from 'react';
import { renderWithProviders, screen, setupApiMocks, setupTezosToolkitMock, setupBeaconWalletMock } from '../utils/test-utils';
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

describe('Basic Component Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTezosToolkitMock();
    setupBeaconWalletMock();
  });

  it('renders without crashing', async () => {
    renderWithProviders(<CollectorRanking />);
    
    // Check that loading state is initially shown
    expect(screen.getByTestId('loading-skeleton-table')).toBeInTheDocument();
  });
}); 