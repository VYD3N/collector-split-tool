import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'react-query';
import {
    VStack,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Skeleton,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Button,
    useToast
} from '@chakra-ui/react';
import { Collector } from '../types/collector';
import { api } from '../services/api';
import { formatAddress, formatTez } from '../utils/formatting';

// Types
type SortField = 'rank' | 'total_nfts' | 'lifetime_spent' | 'score' | 'share';
type SortOrder = 'asc' | 'desc';

interface CollectorRankingProps {
    onCollectorsLoaded?: (collectors: Collector[]) => void;
}

export const CollectorRanking: React.FC<CollectorRankingProps> = ({
    onCollectorsLoaded
}) => {
    // State management
    const [sortField, setSortField] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [filterText, setFilterText] = useState('');
    const [minNFTs, setMinNFTs] = useState(0);
    const [selectedCollectors, setSelectedCollectors] = useState<string[]>([]);
    
    const toast = useToast();

    // Fetch collectors data
    const {
        data: collectors,
        isLoading,
        error,
        refetch
    } = useQuery<Collector[]>(
        'collectors',
        async () => {
            try {
                const response = await api.getCollectors('KT1test');
                if (response.error) {
                    throw new Error(response.error);
                }
                // Notify parent component if needed
                if (onCollectorsLoaded && response.collectors) {
                    onCollectorsLoaded(response.collectors);
                }
                return response.collectors;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch collectors';
                toast({
                    title: 'Error fetching collectors',
                    description: errorMessage,
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
                throw err;
            }
        },
        {
            retry: 2,
            staleTime: 30000, // Consider data fresh for 30 seconds
            cacheTime: 300000 // Cache for 5 minutes
        }
    );

    // Sorting logic
    const sortCollectors = useCallback((a: Collector, b: Collector): number => {
        const getValue = (collector: Collector) => {
            switch (sortField) {
                case 'total_nfts':
                    return collector.total_nfts;
                case 'lifetime_spent':
                    return collector.lifetime_spent;
                case 'score':
                    return collector.score;
                case 'share':
                    return collector.share || 0;
                default:
                    return collector.score;
            }
        };

        const aValue = getValue(a);
        const bValue = getValue(b);

        return sortOrder === 'asc' 
            ? aValue - bValue 
            : bValue - aValue;
    }, [sortField, sortOrder]);

    // Filtering logic
    const filteredCollectors = useMemo(() => {
        if (!collectors) return [];

        return collectors.filter(collector => {
            // Apply minimum NFTs filter
            if (collector.total_nfts < minNFTs) return false;

            // Apply text filter
            if (filterText) {
                const searchText = filterText.toLowerCase();
                return collector.address.toLowerCase().includes(searchText);
            }

            return true;
        });
    }, [collectors, filterText, minNFTs]);

    // Sort filtered collectors
    const sortedCollectors = useMemo(() => {
        return [...filteredCollectors].sort(sortCollectors);
    }, [filteredCollectors, sortCollectors]);

    // Selection handling
    const handleCollectorSelect = useCallback((address: string) => {
        setSelectedCollectors(prev => {
            const isSelected = prev.includes(address);
            if (isSelected) {
                return prev.filter(a => a !== address);
            } else {
                return [...prev, address];
            }
        });
    }, []);

    // Calculate stats for selected collectors
    const selectedStats = useMemo(() => {
        const selected = sortedCollectors.filter(c => 
            selectedCollectors.includes(c.address)
        );

        return {
            totalNFTs: selected.reduce((sum, c) => sum + c.total_nfts, 0),
            totalSpent: selected.reduce((sum, c) => sum + c.lifetime_spent, 0),
            averageScore: selected.length 
                ? selected.reduce((sum, c) => sum + c.score, 0) / selected.length 
                : 0
        };
    }, [sortedCollectors, selectedCollectors]);

    if (isLoading) {
        return (
            <VStack spacing={4} align="stretch">
                <Skeleton height="40px" />
                <Skeleton height="400px" />
            </VStack>
        );
    }

    if (error) {
        return (
            <Alert
                status="error"
                variant="subtle"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                height="200px"
            >
                <AlertIcon boxSize="40px" mr={0} />
                <AlertTitle mt={4} mb={1} fontSize="lg">
                    Error Loading Collectors
                </AlertTitle>
                <AlertDescription maxWidth="sm">
                    {error instanceof Error ? error.message : 'An error occurred while loading collectors.'}
                    <Button
                        colorScheme="red"
                        size="sm"
                        mt={4}
                        onClick={() => refetch()}
                    >
                        Try Again
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <VStack spacing={4} align="stretch">
            {/* Filters will be added here in Phase 2 */}
            
            <Table variant="simple">
                <Thead>
                    <Tr>
                        <Th>Rank</Th>
                        <Th>Address</Th>
                        <Th isNumeric>NFTs</Th>
                        <Th isNumeric>Spent</Th>
                        <Th isNumeric>Score</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedCollectors.map((collector, index) => (
                        <Tr 
                            key={collector.address}
                            onClick={() => handleCollectorSelect(collector.address)}
                            cursor="pointer"
                            bg={selectedCollectors.includes(collector.address) ? "gray.50" : undefined}
                            _hover={{ bg: "gray.50" }}
                        >
                            <Td>{index + 1}</Td>
                            <Td>{formatAddress(collector.address)}</Td>
                            <Td isNumeric>{collector.total_nfts}</Td>
                            <Td isNumeric>{formatTez(collector.lifetime_spent)}</Td>
                            <Td isNumeric>{collector.score.toFixed(2)}</Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </VStack>
    );
}; 