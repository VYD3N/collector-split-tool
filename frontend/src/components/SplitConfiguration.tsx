import React, { useState, useEffect } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Button,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Alert,
    AlertIcon,
    useToast,
    Card,
    CardHeader,
    CardBody,
    Badge,
    Tooltip,
    IconButton,
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    Progress,
    Collapse,
    FormControl,
    FormLabel,
    Input
} from '@chakra-ui/react';
import { DeleteIcon, InfoIcon, WarningIcon, CopyIcon } from '@chakra-ui/icons';
import { Collector } from '../types/collector';
import { formatAddress, formatTez } from '../utils/formatting';

export interface SplitConfigurationProps {
    collectors: Collector[];
    creatorAddress?: string;
}

interface SplitValidation {
    isValid: boolean;
    message: string;
}

export const SplitConfiguration: React.FC<SplitConfigurationProps> = ({
    collectors,
    creatorAddress
}) => {
    const [selectedCollectors, setSelectedCollectors] = useState<Collector[]>([]);
    const [totalSharePercentage, setTotalSharePercentage] = useState(10.0); // Default total share
    const [creatorShare, setCreatorShare] = useState(2.5); // Default 2.5% for creator
    const [collectorTotalShare, setCollectorTotalShare] = useState(7.5); // Default 7.5% for collectors
    const [remainingShare, setRemainingShare] = useState(7.5); // Initialize with collector share
    const [copiedRows, setCopiedRows] = useState<Set<string>>(new Set());
    const [contractAddress, setContractAddress] = useState<string>('');
    const toast = useToast();

    // Constants for validation
    const MIN_COLLECTORS = 3;
    const MAX_COLLECTORS = 1000;
    const MIN_SHARE = 0.1; // 0.1%
    const MAX_SHARE = 50.0; // 50%
    const MIN_TOTAL_SHARE = 0.0; // Minimum total share percentage
    const MAX_TOTAL_SHARE = 25.0; // Maximum total share percentage
    const BURN_ADDRESS = "tz1burnburnburnburnburnburnburjAYjjX";

    // After the MIN_COLLECTORS and MAX_COLLECTORS constants, add a state for minimum share threshold
    const [currentMinShare, setCurrentMinShare] = useState<number>(MIN_SHARE);

    // Fix the creatorAddress state by making it optional and using the prop value
    const [localCreatorAddress, setLocalCreatorAddress] = useState<string | null>(creatorAddress || null);

    // Calculate weighted shares based on collector scores
    const calculateWeightedShares = (collectors: Collector[], totalSharePercentage: number): Collector[] => {
        // Filter out the creator and burn address
        const validCollectors = collectors.filter(c => 
            (localCreatorAddress ? c.address !== localCreatorAddress : true) && 
            c.address !== BURN_ADDRESS
        );
        
        // If no collectors, return empty array
        if (!validCollectors.length) return [];

        // Calculate total score
        const totalScore = validCollectors.reduce((sum, collector) => sum + collector.score, 0);
        
        // If total score is 0, distribute evenly
        if (totalScore === 0) {
            const evenShare = totalSharePercentage / validCollectors.length;
            // Only include collectors that would get at least 0.01% share
            if (evenShare < 0.01) {
                // Calculate how many collectors we can include while maintaining minimum 0.01% share
                const maxCollectors = Math.floor(totalSharePercentage / 0.01);
                const limitedCollectors = validCollectors.slice(0, Math.max(MIN_COLLECTORS, maxCollectors));
                const adjustedEvenShare = totalSharePercentage / limitedCollectors.length;
                
                const result = limitedCollectors.map(collector => ({
                    ...collector,
                    share: Number(adjustedEvenShare.toFixed(2))
                }));
                
                return balanceShares(result, totalSharePercentage);
            }
            
            const result = validCollectors.map(collector => ({
                ...collector,
                share: Number(evenShare.toFixed(2))
            }));
            
            return balanceShares(result, totalSharePercentage);
        }
        
        // Calculate initial shares based on scores
        let result = validCollectors.map(collector => {
            const proportion = collector.score / totalScore;
            const share = proportion * totalSharePercentage;
            return {
                ...collector,
                share: Number(share.toFixed(2))
            };
        });

        // Filter out collectors that would get less than 0.01% share
        // but ensure we keep at least MIN_COLLECTORS
        result = result
            .sort((a, b) => (b.share || 0) - (a.share || 0))
            .filter((collector, index) => {
                if (index < MIN_COLLECTORS) return true; // Always keep top MIN_COLLECTORS
                return (collector.share || 0) >= 0.01;
            });

        // Recalculate shares for remaining collectors to distribute the total properly
        const remainingTotalScore = result.reduce((sum, c) => sum + c.score, 0);
        result = result.map(collector => ({
            ...collector,
            share: Number((collector.score / remainingTotalScore * totalSharePercentage).toFixed(2))
        }));
        
        // Balance the shares to match total exactly
        return balanceShares(result, totalSharePercentage);
    };

    // Add new function to balance shares
    const balanceShares = (collectors: Collector[], targetTotal: number): Collector[] => {
        if (collectors.length === 0) return collectors;

        // Calculate current total with rounded values
        const currentTotal = collectors.reduce((sum, c) => sum + (c.share || 0), 0);
        let difference = Number((targetTotal - currentTotal).toFixed(2));

        // If difference is negligible, return as is
        if (Math.abs(difference) < 0.01) return collectors;

        // Make a copy of collectors to modify
        let result = [...collectors];
        
        // If we're allowing low shares (currentMinShare === 0), handle differently
        if (currentMinShare === 0) {
            // Sort by share value descending
            result.sort((a, b) => (b.share || 0) - (a.share || 0));
            
            // Calculate minimum viable share (the share that would result in 0.01% after adjustment)
            const minViableShare = Math.abs(difference) / result.length;
            
            // Remove collectors that would end up with less than 0.01% after adjustment
            while (result.length > MIN_COLLECTORS) {
                const wouldBeNegative = result.some((c, i) => {
                    const share = c.share || 0;
                    const adjustment = difference / result.length;
                    return share + adjustment < 0.01;
                });
                
                if (!wouldBeNegative) break;
                
                // Remove the collector with the lowest share
                result = result.slice(0, -1);
                
                // Recalculate difference for remaining collectors
                const newTotal = result.reduce((sum, c) => sum + (c.share || 0), 0);
                difference = Number((targetTotal - newTotal).toFixed(2));
            }
            
            // Now distribute the difference among remaining collectors
            const adjustmentPerCollector = Number((difference / result.length).toFixed(2));
            result = result.map(collector => ({
                ...collector,
                share: Number(((collector.share || 0) + adjustmentPerCollector).toFixed(2))
            }));
            
            // Handle any remaining small difference due to rounding
            const finalTotal = result.reduce((sum, c) => sum + (c.share || 0), 0);
            const remainingDiff = Number((targetTotal - finalTotal).toFixed(2));
            if (Math.abs(remainingDiff) >= 0.01 && result.length > 0) {
                const lastCollector = result[result.length - 1];
                const lastCollectorShare = lastCollector.share || 0;
                result[result.length - 1] = {
                    ...lastCollector,
                    share: Number((lastCollectorShare + remainingDiff).toFixed(2))
                };
            }
            
            return result;
        }
        
        // Original logic for when we're not allowing low shares
        const numToAdjust = Math.abs(difference) > 0.01 ? 2 : 1;
        const lastCollectors = result.slice(-numToAdjust);
        const adjustmentPerCollector = Number((difference / numToAdjust).toFixed(2));
        
        lastCollectors.forEach((collector, index) => {
            const isLastOne = index === lastCollectors.length - 1;
            const adjustment = isLastOne ? 
                difference : // Last collector gets remaining difference
                adjustmentPerCollector; // Others get equal share
            
            const collectorIndex = result.length - numToAdjust + index;
            result[collectorIndex] = {
                ...collector,
                share: Number(((collector.share || 0) + adjustment).toFixed(2))
            };
            
            difference = Number((difference - adjustment).toFixed(2));
        });

        return result;
    };

    useEffect(() => {
        // First check if a creator address was passed as prop
        if (creatorAddress) {
            setLocalCreatorAddress(creatorAddress);
        }
        // Otherwise identify the creator (assumed to be top-scoring collector)
        else if (collectors.length > 0) {
            const creatorCollector = [...collectors]
                .filter(c => c.address !== BURN_ADDRESS)
                .sort((a, b) => b.score - a.score)[0];
            setLocalCreatorAddress(creatorCollector.address);
        }
    }, [collectors, creatorAddress]);

    useEffect(() => {
        // Initialize with all available collectors up to MAX_COLLECTORS
        if (collectors.length > 0) {
            // First, identify the creator (assumed to be top-scoring collector)
            const creatorCollector = [...collectors]
                .filter(c => c.address !== BURN_ADDRESS)
                .sort((a, b) => b.score - a.score)[0];
            
            // Filter out the creator and burn address from the list of collectors
            const validCollectors = collectors.filter(c => 
                c.address !== creatorCollector.address && 
                c.address !== BURN_ADDRESS
            );
            
            // Use all collectors up to MAX_COLLECTORS
            const initialCount = Math.min(validCollectors.length, MAX_COLLECTORS);
            const initialCollectors = validCollectors.slice(0, initialCount);
            
            // Calculate weighted shares based on scores
            const collectorsWithShares = calculateWeightedShares(initialCollectors, collectorTotalShare);
            setSelectedCollectors(collectorsWithShares);
            calculateRemainingShare(collectorsWithShares);
        }
    }, [collectors, collectorTotalShare]);

    const calculateRemainingShare = (splits: Collector[]) => {
        const usedShare = splits.reduce((sum, c) => sum + (c.share || 0), 0);
        const remaining = Number((collectorTotalShare - usedShare).toFixed(4));
        setRemainingShare(remaining);
    };

    // Add a function to handle allowing low shares
    const handleAllowLowShares = () => {
        // Set the minimum share threshold to 0
        setCurrentMinShare(0);
        
        toast({
            title: 'Low Shares Allowed',
            description: `All collectors will be kept, regardless of share percentage`,
            status: 'success',
            duration: 2000,
            isClosable: true,
        });
    };

    // Modify validateSplits to use the currentMinShare instead of MIN_SHARE
    const validateSplits = (): SplitValidation => {
        if (selectedCollectors.length < MIN_COLLECTORS) {
            return {
                isValid: false,
                message: `Minimum ${MIN_COLLECTORS} collectors required`
            };
        }

        if (selectedCollectors.length > MAX_COLLECTORS) {
            return {
                isValid: false,
                message: `Maximum ${MAX_COLLECTORS} collectors allowed`
            };
        }

        const totalUsed = selectedCollectors.reduce((sum, c) => sum + (c.share || 0), 0);
        if (Math.abs(totalUsed - collectorTotalShare) > 0.01) { // Allow small rounding differences
            return {
                isValid: false,
                message: `Total share must equal ${collectorTotalShare}%`
            };
        }

        const invalidShares = selectedCollectors.some(c => 
            (c.share || 0) < currentMinShare || (c.share || 0) > MAX_SHARE
        );
        if (invalidShares) {
            return {
                isValid: false,
                message: `Individual shares must be between ${currentMinShare}% and ${MAX_SHARE}%`
            };
        }

        return { isValid: true, message: '' };
    };

    const handleShareChange = (index: number, value: number) => {
        const newCollectors = [...selectedCollectors];
        newCollectors[index] = {
            ...newCollectors[index],
            share: value
        };
        setSelectedCollectors(newCollectors);
        calculateRemainingShare(newCollectors);
    };

    const handleRemoveCollector = (index: number) => {
        const newCollectors = selectedCollectors.filter((_, i) => i !== index);
        
        // Recalculate shares for remaining collectors
        const updatedCollectors = calculateWeightedShares(newCollectors, collectorTotalShare);
        
        setSelectedCollectors(updatedCollectors);
        calculateRemainingShare(updatedCollectors);
    };

    const handleAddCollector = () => {
        if (selectedCollectors.length >= MAX_COLLECTORS) {
            toast({
                title: 'Error',
                description: `Maximum ${MAX_COLLECTORS} collectors allowed`,
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        // Find collectors not already selected, excluding burn address
        const availableCollectors = collectors.filter(c => 
            !selectedCollectors.some(sc => sc.address === c.address) &&
            c.address !== BURN_ADDRESS
        );

        if (availableCollectors.length === 0) {
            toast({
                title: 'Error',
                description: 'No more collectors available',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        // Determine how many to add at once based on available collectors
        // For large datasets, add 5 at a time to make it more efficient
        const batchSize = availableCollectors.length > 20 ? 5 : 1;
        const collectorsToAdd = availableCollectors.slice(0, Math.min(batchSize, MAX_COLLECTORS - selectedCollectors.length));
        
        // Add the new collectors to the selected collectors
        const newCollectorsList = [...selectedCollectors, ...collectorsToAdd];
        
        // Recalculate shares for all collectors including the new ones
        const updatedCollectors = calculateWeightedShares(newCollectorsList, collectorTotalShare);
        
        setSelectedCollectors(updatedCollectors);
        calculateRemainingShare(updatedCollectors);
        
        // Show feedback if adding multiple
        if (collectorsToAdd.length > 1) {
            toast({
                title: 'Multiple Collectors Added',
                description: `Added ${collectorsToAdd.length} collectors to the configuration`,
                status: 'success',
                duration: 2000,
                isClosable: true,
            });
        }
    };

    const handleRemoveBelowThreshold = () => {
        // Count how many would be removed
        const belowThreshold = selectedCollectors.filter(c => (c.share || 0) < currentMinShare);
        const remainingCount = selectedCollectors.length - belowThreshold.length;
        
        // Check if removing would violate minimum collectors requirement
        if (remainingCount < MIN_COLLECTORS) {
            toast({
                title: 'Cannot Remove',
                description: `Removing these collectors would leave fewer than the minimum ${MIN_COLLECTORS} required collectors`,
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        
        // Remove collectors below threshold
        const filteredCollectors = selectedCollectors.filter(c => (c.share || 0) >= currentMinShare);
        
        // Recalculate shares for remaining collectors
        const updatedCollectors = calculateWeightedShares(filteredCollectors, collectorTotalShare);
        
        setSelectedCollectors(updatedCollectors);
        calculateRemainingShare(updatedCollectors);
        
        toast({
            title: 'Collectors Removed',
            description: `Removed ${belowThreshold.length} collectors with shares below ${currentMinShare}%`,
            status: 'success',
            duration: 2000,
            isClosable: true,
        });
    };

    // Modify getShareColor to use currentMinShare
    const getShareColor = (share: number) => {
        if (share < currentMinShare) return 'red.500';
        if (share > MAX_SHARE) return 'red.500';
        return 'green.500';
    };

    // Get badge color based on collector ranking
    const getBadgeColor = (index: number) => {
        if (index < 3) return "green"; // Top 3
        if (index < 7) return "teal";  // Top 4-7
        if (index < 15) return "blue"; // Top 8-15
        if (index < 30) return "purple"; // Top 16-30
        if (index < 50) return "orange"; // Top 31-50
        return "gray";                 // Others
    };

    // Count collectors below threshold using currentMinShare
    const countBelowThreshold = selectedCollectors.filter(c => (c.share || 0) < currentMinShare).length;

    // Add the missing totalShare calculation
    // Total share is now derived from creator + collector shares
    const totalShare = creatorShare + collectorTotalShare;

    // Handle total share percentage change
    const handleTotalShareChange = (newTotal: number) => {
        if (newTotal < MIN_TOTAL_SHARE || newTotal > MAX_TOTAL_SHARE) return;
        
        setTotalSharePercentage(newTotal);
        
        // Maintain the same proportion between creator and collector shares
        const currentTotal = creatorShare + collectorTotalShare;
        if (currentTotal > 0) {
            const creatorProportion = creatorShare / currentTotal;
            const newCreatorShare = Number((newTotal * creatorProportion).toFixed(1));
            const newCollectorShare = Number((newTotal - newCreatorShare).toFixed(1));
            
            setCreatorShare(newCreatorShare);
            setCollectorTotalShare(newCollectorShare);
            
            // Recalculate collector shares
            if (selectedCollectors.length > 0) {
                const updatedCollectors = calculateWeightedShares(selectedCollectors, newCollectorShare);
                setSelectedCollectors(updatedCollectors);
                calculateRemainingShare(updatedCollectors);
            } else {
                setRemainingShare(newCollectorShare);
            }
        } else {
            // If no current shares, set default proportions
            const newCreatorShare = Number((newTotal * 0.25).toFixed(1)); // 25% of total to creator
            const newCollectorShare = Number((newTotal * 0.75).toFixed(1)); // 75% of total to collectors
            setCreatorShare(newCreatorShare);
            setCollectorTotalShare(newCollectorShare);
            setRemainingShare(newCollectorShare);
        }
    };

    // Modify the handleRowCopy function to toggle highlight
    const handleRowCopy = async (text: string, address: string) => {
        try {
            await navigator.clipboard.writeText(text);
            // Toggle the address in copied rows
            setCopiedRows(prev => {
                const newSet = new Set(Array.from(prev));
                if (newSet.has(address)) {
                    newSet.delete(address);
                } else {
                    newSet.add(address);
                }
                
                // Show toast based on new state
                toast({
                    title: newSet.has(address) ? 'Copied and marked!' : 'Unmarked',
                    status: 'success',
                    duration: 1000,
                    isClosable: true,
                });
                
                return newSet;
            });
        } catch (err) {
            toast({
                title: 'Failed to copy',
                status: 'error',
                duration: 2000,
                isClosable: true,
            });
        }
    };

    return (
        <VStack spacing={6} align="stretch">
            <Card>
                <CardHeader pb={1}>
                    <HStack justify="space-between" spacing={2}>
                        <Text fontSize="lg" fontWeight="bold">Tezos Split Configuration</Text>
                        <Tooltip label={`Configure revenue splits between ${MIN_COLLECTORS}-${MAX_COLLECTORS} collectors out of ${collectors.length} available collectors`}>
                            <Box><InfoIcon /></Box>
                        </Tooltip>
                    </HStack>
                </CardHeader>
                <CardBody pt={1}>
                    <VStack spacing={3}>
                        {/* Configuration Section - Ultra Compact */}
                        <Box width="full" borderWidth="1px" borderRadius="md" p={2}>
                            <HStack width="full" spacing={3} align="flex-end">
                                <FormControl flex={1}>
                                    <FormLabel fontSize="sm" mb={1}>Total Share (%)</FormLabel>
                                    <NumberInput
                                        value={totalSharePercentage}
                                        min={MIN_TOTAL_SHARE}
                                        max={MAX_TOTAL_SHARE}
                                        step={0.1}
                                        precision={2}
                                        allowMouseWheel
                                        clampValueOnBlur={false}
                                        size="md"
                                        onChange={(valueString) => {
                                            const value = parseFloat(valueString);
                                            if (!isNaN(value)) {
                                                handleTotalShareChange(value);
                                            }
                                        }}
                                    >
                                        <NumberInputField fontSize="md" />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                </FormControl>

                                {localCreatorAddress && (
                                    <FormControl flex={2}>
                                        <FormLabel fontSize="sm" mb={1}>Creator Royalty (%)</FormLabel>
                                        <HStack spacing={1}>
                                            <Text fontSize="sm" flex={2} noOfLines={1}>{localCreatorAddress}</Text>
                                            <IconButton
                                                aria-label="Copy creator address"
                                                icon={<CopyIcon />}
                                                size="sm"
                                                variant="ghost"
                                                colorScheme={copiedRows.has(localCreatorAddress) ? "green" : "gray"}
                                                onClick={() => handleRowCopy(localCreatorAddress, localCreatorAddress)}
                                            />
                                            <NumberInput
                                                value={creatorShare}
                                                min={0}
                                                max={totalSharePercentage}
                                                step={0.1}
                                                precision={2}
                                                allowMouseWheel
                                                clampValueOnBlur={false}
                                                size="md"
                                                w="100px"
                                                onChange={(valueString) => {
                                                    const value = parseFloat(valueString);
                                                    if (!isNaN(value)) {
                                                        const newCreatorShare = value;
                                                        setCreatorShare(newCreatorShare);
                                                        const newCollectorShare = Number((totalSharePercentage - newCreatorShare).toFixed(2));
                                                        setCollectorTotalShare(newCollectorShare);
                                                        if (selectedCollectors.length > 0) {
                                                            const updatedCollectors = calculateWeightedShares(selectedCollectors, newCollectorShare);
                                                            setSelectedCollectors(updatedCollectors);
                                                            calculateRemainingShare(updatedCollectors);
                                                        } else {
                                                            setRemainingShare(newCollectorShare);
                                                        }
                                                    }
                                                }}
                                            >
                                                <NumberInputField fontSize="md" />
                                                <NumberInputStepper>
                                                    <NumberIncrementStepper />
                                                    <NumberDecrementStepper />
                                                </NumberInputStepper>
                                            </NumberInput>
                                        </HStack>
                                    </FormControl>
                                )}

                                <FormControl flex={1}>
                                    <FormLabel fontSize="sm" mb={1}>Collector Share (%)</FormLabel>
                                    <NumberInput
                                        value={collectorTotalShare}
                                        min={0}
                                        max={totalSharePercentage}
                                        step={0.1}
                                        precision={2}
                                        allowMouseWheel
                                        clampValueOnBlur={false}
                                        size="md"
                                        onChange={(valueString) => {
                                            const value = parseFloat(valueString);
                                            if (!isNaN(value)) {
                                                const newCollectorShare = value;
                                                setCollectorTotalShare(newCollectorShare);
                                                const newCreatorShare = Number((totalSharePercentage - newCollectorShare).toFixed(2));
                                                setCreatorShare(newCreatorShare);
                                                if (selectedCollectors.length > 0) {
                                                    const updatedCollectors = calculateWeightedShares(selectedCollectors, newCollectorShare);
                                                    setSelectedCollectors(updatedCollectors);
                                                    calculateRemainingShare(updatedCollectors);
                                                } else {
                                                    setRemainingShare(newCollectorShare);
                                                }
                                            }
                                        }}
                                    >
                                        <NumberInputField fontSize="md" />
                                        <NumberInputStepper>
                                            <NumberIncrementStepper />
                                            <NumberDecrementStepper />
                                        </NumberInputStepper>
                                    </NumberInput>
                                </FormControl>
                            </HStack>
                        </Box>

                        {/* Share Distribution Section - Prominent */}
                        <Box width="full">
                            <Text fontSize="lg" fontWeight="bold" mb={2}>Share Distribution</Text>
                            <Progress
                                value={100}
                                colorScheme={remainingShare === 0 ? "green" : remainingShare > 0 ? "blue" : Math.abs(remainingShare) < 0.01 ? "green" : "orange"}
                                height="12px"
                                borderRadius="full"
                            />
                            <Text 
                                fontSize="sm" 
                                color={
                                    remainingShare === 0 || Math.abs(remainingShare) < 0.01 ? "green.500" : 
                                    remainingShare > 0 ? "gray.500" : 
                                    currentMinShare === 0 ? "gray.500" : "orange.500"
                                } 
                                mt={2}
                                mb={4}
                            >
                                {remainingShare === 0 || Math.abs(remainingShare) < 0.01 ? (
                                    <>Perfect allocation of {collectorTotalShare.toFixed(2)}% to collectors</>
                                ) : remainingShare > 0 ? (
                                    <>Remaining: {remainingShare.toFixed(2)}% of {collectorTotalShare.toFixed(2)}% collector share</>
                                ) : currentMinShare === 0 ? (
                                    <>All {collectorTotalShare.toFixed(2)}% allocated to collectors (including small shares)</>
                                ) : (
                                    <>Over-allocated by {Math.abs(remainingShare).toFixed(2)}% (collectors need {(collectorTotalShare - remainingShare).toFixed(2)}%, have {collectorTotalShare.toFixed(2)}% available)</>
                                )}
                                {localCreatorAddress && ` • Creator royalty: ${creatorShare.toFixed(2)}%`}
                            </Text>
                        </Box>

                        {/* Table Section - Limited Height for 20 Items */}
                        <Box 
                            width="full" 
                            maxHeight="800px"
                            height="800px"
                            overflowY="auto"
                            borderWidth="1px"
                            borderRadius="md"
                            css={{
                                '&::-webkit-scrollbar': {
                                    width: '8px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    width: '10px',
                                    background: '#f1f1f1',
                                    borderRadius: '4px',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: '#888',
                                    borderRadius: '4px',
                                    '&:hover': {
                                        background: '#555'
                                    }
                                },
                            }}
                        >
                            <Table variant="simple" size="sm">
                                <Thead position="sticky" top={0} bg="white" zIndex={1} boxShadow="sm">
                                    <Tr>
                                        <Th width="40px" px={1}>#</Th>
                                        <Th>Collector</Th>
                                        <Th isNumeric width="60px">
                                            <Tooltip label="Score is calculated based on collector's engagement and contribution metrics, including frequency of interactions, total volume, and historical participation. Higher scores result in larger share allocations.">
                                                <Text as="span" cursor="help">Score</Text>
                                            </Tooltip>
                                        </Th>
                                        <Th isNumeric width="180px">Share (%)</Th>
                                        <Th width="40px"></Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {selectedCollectors.map((collector, index) => (
                                        <Tr 
                                            key={collector.address}
                                            bg={copiedRows.has(collector.address) ? "green.50" : undefined}
                                            transition="background-color 0.2s"
                                        >
                                            <Td px={1}>
                                                <Badge
                                                    colorScheme={getBadgeColor(index)}
                                                    borderRadius="full"
                                                    minW="20px"
                                                    fontSize="xs"
                                                    textAlign="center"
                                                    p={1}
                                                >
                                                    {index + 1}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <HStack spacing={2}>
                                                    <Text>{collector.address}</Text>
                                                    <IconButton
                                                        aria-label="Copy address"
                                                        icon={<CopyIcon />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme={copiedRows.has(collector.address) ? "green" : "gray"}
                                                        onClick={() => handleRowCopy(collector.address, collector.address)}
                                                    />
                                                </HStack>
                                            </Td>
                                            <Td isNumeric>
                                                {collector.score.toFixed(1)}
                                            </Td>
                                            <Td isNumeric>
                                                <HStack justify="flex-end" spacing={2}>
                                                    <Text>
                                                        {(collector.share || 0).toFixed(2)}
                                                    </Text>
                                                    <IconButton
                                                        aria-label="Copy share"
                                                        icon={<CopyIcon />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme={copiedRows.has(collector.address) ? "green" : "gray"}
                                                        onClick={() => handleRowCopy((collector.share || 0).toFixed(2), collector.address)}
                                                    />
                                                    <NumberInput
                                                        value={collector.share || 0}
                                                        min={0}
                                                        max={MAX_SHARE}
                                                        step={0.1}
                                                        precision={2}
                                                        allowMouseWheel
                                                        clampValueOnBlur={false}
                                                        onChange={(valueString) => {
                                                            const value = parseFloat(valueString);
                                                            if (!isNaN(value)) {
                                                                handleShareChange(index, value);
                                                            }
                                                        }}
                                                        w="100px"
                                                    >
                                                        <NumberInputField 
                                                            textAlign="right"
                                                            color={getShareColor(collector.share || 0)}
                                                        />
                                                        <NumberInputStepper>
                                                            <NumberIncrementStepper />
                                                            <NumberDecrementStepper />
                                                        </NumberInputStepper>
                                                    </NumberInput>
                                                </HStack>
                                            </Td>
                                            <Td>
                                                <IconButton
                                                    aria-label="Remove collector"
                                                    icon={<DeleteIcon />}
                                                    size="sm"
                                                    colorScheme="red"
                                                    variant="ghost"
                                                    onClick={() => handleRemoveCollector(index)}
                                                    isDisabled={selectedCollectors.length <= MIN_COLLECTORS}
                                                />
                                            </Td>
                                        </Tr>
                                    ))}
                                </Tbody>
                            </Table>
                        </Box>

                        {/* Buttons Section */}
                        {(() => {
                            const availableCollectors = collectors.filter(c => 
                                !selectedCollectors.some(sc => sc.address === c.address) &&
                                c.address !== BURN_ADDRESS
                            );

                            return (
                                <VStack width="full" spacing={3}>
                                    <HStack width="full" justify="space-between">
                                        <Button
                                            onClick={handleAddCollector}
                                            isDisabled={selectedCollectors.length >= MAX_COLLECTORS || selectedCollectors.length >= collectors.length}
                                        >
                                            {availableCollectors.length > 20 
                                                ? `Add Collectors (${selectedCollectors.length}/${Math.min(collectors.length, MAX_COLLECTORS)})` 
                                                : `Add Collector (${selectedCollectors.length}/${Math.min(collectors.length, MAX_COLLECTORS)})`}
                                        </Button>
                                        
                                        {countBelowThreshold > 0 && (
                                            <HStack>
                                                <Button
                                                    leftIcon={<WarningIcon />}
                                                    colorScheme="orange"
                                                    onClick={handleRemoveBelowThreshold}
                                                    isDisabled={selectedCollectors.length - countBelowThreshold < MIN_COLLECTORS}
                                                    title={`Remove ${countBelowThreshold} collectors with shares below ${currentMinShare}%`}
                                                >
                                                    Remove {countBelowThreshold} Low Share
                                                </Button>
                                                <Button
                                                    colorScheme="teal"
                                                    onClick={handleAllowLowShares}
                                                    title="Keep all collectors even with very small shares"
                                                >
                                                    Allow Low Share
                                                </Button>
                                            </HStack>
                                        )}
                                    </HStack>
                                </VStack>
                            );
                        })()}
                    </VStack>
                </CardBody>
            </Card>
        </VStack>
    );
};