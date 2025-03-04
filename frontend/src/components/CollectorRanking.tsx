import React, { useState, useEffect } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Button,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Spinner,
    Alert,
    AlertIcon,
    Badge,
    Input,
    InputGroup,
    InputLeftAddon,
    FormControl,
    FormLabel,
    Switch,
    useToast,
    Tooltip,
    AlertTitle,
    AlertDescription,
    CloseButton,
    Link,
    Collapse,
    IconButton
} from '@chakra-ui/react';
import { SearchIcon, InfoIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { api } from '../services';
import { Collector } from '../types/collector';
import { formatAddress, formatTez } from '../utils/formatting';
import { Skeleton } from '@chakra-ui/react';

interface CollectorRankingProps {
    onCollectorsLoaded: (collectors: Collector[]) => void;
}

export const CollectorRanking: React.FC<CollectorRankingProps> = ({ onCollectorsLoaded }) => {
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contractAddress, setContractAddress] = useState<string>('');
    const [isExpanded, setIsExpanded] = useState(false);
    const toast = useToast();

    const fetchCollectors = async (address: string) => {
        if (!address) {
            setError('Please enter a contract address');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.getCollectors(address);
            
            if (response.error) {
                setError(response.error);
                setCollectors([]);
                onCollectorsLoaded([]);
                return;
            }
            
            if (!response.collectors || response.collectors.length === 0) {
                setError('No collectors found for this contract');
                setCollectors([]);
                onCollectorsLoaded([]);
                return;
            }
            
            const sortedCollectors = [...response.collectors].sort((a, b) => b.score - a.score);
            console.log(`Loaded ${sortedCollectors.length} collectors`);
            
            setCollectors(sortedCollectors);
            onCollectorsLoaded(sortedCollectors);
            
            toast({
                title: 'Collectors Loaded',
                description: `Found ${sortedCollectors.length} collectors for the contract`,
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';
            console.error(`Error fetching collectors: ${errorMessage}`);
            setError(errorMessage);
            setCollectors([]);
            onCollectorsLoaded([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (contractAddress) {
            console.log(`Initial fetch for contract: ${contractAddress}`);
            fetchCollectors(contractAddress);
        }
    }, [contractAddress]);

    useEffect(() => {
        if (collectors.length > 0) {
            const spendingCollectors = collectors.filter(c => c.lifetime_spent > 0);
            console.log(`Collectors with spending data: ${spendingCollectors.length}/${collectors.length}`);
            
            const topSpenders = [...collectors].sort((a, b) => b.lifetime_spent - a.lifetime_spent).slice(0, 5);
            console.log("Top spenders:", topSpenders.map(c => ({
                address: c.address,
                spent: c.lifetime_spent
            })));
            
            if (spendingCollectors.length === 0) {
                console.warn("No collectors have spending data - check API implementation");
            }
        }
    }, [collectors]);

    return (
        <VStack spacing={6} align="stretch">
            <Box p={4} borderWidth="1px" borderRadius="lg">
                <VStack spacing={4} align="stretch">
                    <HStack justifyContent="space-between">
                        <Text fontSize="lg" fontWeight="bold">Collector Ranking</Text>
                        {collectors.length > 0 && (
                            <IconButton
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                                icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                onClick={() => setIsExpanded(!isExpanded)}
                                variant="ghost"
                            />
                        )}
                    </HStack>
                    
                    <FormControl>
                        <FormLabel>Tezos Contract Address</FormLabel>
                        <Input
                            value={contractAddress}
                            onChange={(e) => setContractAddress(e.target.value)}
                            placeholder="Enter contract address"
                            size="md"
                        />
                    </FormControl>

                    <Button
                        onClick={() => fetchCollectors(contractAddress)}
                        colorScheme="blue"
                        isLoading={isLoading}
                        loadingText="Fetching collectors..."
                    >
                        Fetch Collectors
                    </Button>

                    {error && (
                        <Alert status="error" data-testid="error-alert">
                            <AlertIcon />
                            <Box flex="1">
                                <AlertTitle>Error Loading Collectors</AlertTitle>
                                <AlertDescription display="block">
                                    {error}
                                </AlertDescription>
                            </Box>
                            <CloseButton
                                position="absolute"
                                right="8px"
                                top="8px"
                                onClick={() => setError(null)}
                            />
                        </Alert>
                    )}

                    <Collapse in={isExpanded} animateOpacity>
                        {isLoading ? (
                            <VStack spacing={4} align="stretch">
                                <Skeleton height="40px" data-testid="loading-skeleton-filters" />
                                <Skeleton height="200px" data-testid="loading-skeleton-table" />
                                <Skeleton height="100px" data-testid="loading-skeleton-content" />
                            </VStack>
                        ) : collectors.length > 0 ? (
                            <Table variant="simple">
                                <Thead>
                                    <Tr>
                                        <Th>Rank</Th>
                                        <Th>Address</Th>
                                        <Th isNumeric>Score</Th>
                                        <Th isNumeric>NFTs</Th>
                                        <Th isNumeric>Spent (ꜩ)</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {collectors.map((collector, index) => (
                                        <Tr key={collector.address}>
                                            <Td>{index + 1}</Td>
                                            <Td>
                                                <Link
                                                    href={`https://tzkt.io/${collector.address}`}
                                                    isExternal
                                                    color="blue.500"
                                                >
                                                    {collector.address.slice(0, 6)}...{collector.address.slice(-4)}
                                                    <ExternalLinkIcon mx="2px" />
                                                </Link>
                                            </Td>
                                            <Td isNumeric>{collector.score.toFixed(2)}</Td>
                                            <Td isNumeric>{collector.total_nfts}</Td>
                                            <Td isNumeric>{collector.lifetime_spent.toFixed(2)}</Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                            </Table>
                        ) : null}
                    </Collapse>
                </VStack>
            </Box>
        </VStack>
    );
};