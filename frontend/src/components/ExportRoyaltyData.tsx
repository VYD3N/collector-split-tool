import React, { useState } from 'react';
import {
  Button,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
  VStack,
  Box,
  Code,
  HStack,
  Badge
} from '@chakra-ui/react';
import { CopyIcon, InfoIcon, CheckIcon } from '@chakra-ui/icons';
import { CollectorShare } from '../utils/metadata';

interface ExportRoyaltyDataProps {
  shares: CollectorShare[];
  creatorAddress?: string;
  creatorShare: number;
}

/**
 * Component for exporting royalty data in a format compatible with OBJKT's mint form
 */
const ExportRoyaltyData: React.FC<ExportRoyaltyDataProps> = ({
  shares,
  creatorAddress,
  creatorShare
}) => {
  const toast = useToast();
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Function to handle copying royalty data to clipboard
  const handleCopyRoyaltyData = () => {
    try {
      // Filter out any empty addresses or zero shares
      const validShares = shares
        .filter(share => share.address && share.share > 0)
        .map(({ address, share }) => ({
          address,
          share: parseFloat(share.toFixed(2))
        }));
      
      // Add creator if not already included (and has valid address/share)
      if (creatorAddress && creatorShare > 0) {
        if (!validShares.some(share => share.address === creatorAddress)) {
          validShares.push({ 
            address: creatorAddress, 
            share: creatorShare 
          });
        }
      }
      
      // Format for OBJKT's mint form
      const objktFormat = validShares.map(share => 
        `${share.address}: ${share.share}%`
      ).join('\n');
      
      // Create a summary for the clipboard
      const totalShare = validShares.reduce((sum, share) => sum + share.share, 0);
      const recipientCount = validShares.length;
      
      const clipboardText = 
`// Royalty Splits for OBJKT Mint Form
// Total royalty: ${totalShare.toFixed(2)}%
// Recipients: ${recipientCount}

${objktFormat}`;

      // Copy to clipboard
      navigator.clipboard.writeText(clipboardText);
      
      // Show success message
      toast({
        title: "Royalty data copied!",
        description: `${recipientCount} recipients with ${totalShare.toFixed(2)}% total royalty copied to clipboard.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error copying royalty data:", error);
      // Show error message
      toast({
        title: "Error copying data",
        description: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Function to handle showing OBJKT instructions
  const handleShowObjktInstructions = () => {
    setShowInstructionsModal(true);
  };
  
  const instructionsText = `
How to use the royalty data in OBJKT:

1. Copy the royalty data using the "Copy Royalty Data" button
2. Go to OBJKT.com and click "Create" to start a new mint
3. Fill in your NFT details (name, description, etc.)
4. In the "Royalties" section, paste the copied data into the "Add royalty recipient" field
5. Add each recipient one by one, matching the addresses and percentages from your copied data
6. Ensure the total royalty percentage matches what was copied (maximum 25%)
7. Complete the mint process on OBJKT
  `;
  
  // Add proper interface for CopyButton props
  interface CopyButtonProps {
    text: string;
    tooltipLabel?: string;
  }

  // Update the CopyButton component with proper typing
  const CopyButton: React.FC<CopyButtonProps> = ({ text, tooltipLabel = "Copy" }) => {
    const toast = useToast();
    const [hasCopied, setHasCopied] = useState(false);
    
    const handleCopy = () => {
      navigator.clipboard.writeText(text)
        .then(() => {
          setHasCopied(true);
          toast({
            title: "Copied!",
            description: `${tooltipLabel} copied to clipboard`,
            status: "success",
            duration: 2000,
            isClosable: true,
            position: "top"
          });
          
          // Reset the copy icon after 2 seconds
          setTimeout(() => {
            setHasCopied(false);
          }, 2000);
        })
        .catch(err => {
          console.error("Failed to copy:", err);
          toast({
            title: "Copy failed",
            description: "Could not copy to clipboard",
            status: "error",
            duration: 2000,
            isClosable: true
          });
        });
    };
    
    return (
      <Button 
        size="xs" 
        onClick={handleCopy} 
        ml={2}
        leftIcon={hasCopied ? <CheckIcon /> : <CopyIcon />}
        colorScheme={hasCopied ? "green" : "gray"}
      >
        {hasCopied ? "Copied!" : "Copy"}
      </Button>
    );
  };
  
  return (
    <VStack spacing={4} align="stretch" width="100%">
      <Text fontSize="md" fontWeight="bold">
        Export Royalty Data
      </Text>
      
      <Box display="flex" flexDirection="row">
        <Button
          leftIcon={<CopyIcon />}
          colorScheme="purple"
          onClick={handleCopyRoyaltyData}
          isDisabled={shares.length === 0 && (!creatorAddress || creatorShare <= 0)}
          mr={2}
        >
          Copy Royalty Data
        </Button>
        
        <Button
          leftIcon={<InfoIcon />}
          colorScheme="blue"
          onClick={handleShowObjktInstructions}
          mr={2}
        >
          How to Use
        </Button>

        <Button
          size="md"
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? "Hide Preview" : "Show Preview"}
        </Button>
      </Box>
      
      {showPreview && (
        <Box 
          mt={4} 
          p={4} 
          borderWidth="1px" 
          borderRadius="md"
          bg="gray.50"
        >
          <Text fontSize="sm" fontWeight="bold" mb={2}>Preview:</Text>
          <Text fontSize="xs" as="div">
            Total Recipients: {
              shares.filter(s => s.address && s.share > 0).length + 
              (creatorAddress && creatorShare > 0 ? 1 : 0)
            }
          </Text>
          <Text fontSize="xs" as="div" mb={2}>
            Total Royalty: {
              (shares.reduce((sum, s) => sum + (s.address && s.share > 0 ? s.share : 0), 0) + 
              (creatorAddress && creatorShare > 0 ? creatorShare : 0)).toFixed(2)
            }%
          </Text>
          
          {/* Table Headers */}
          <HStack justifyContent="space-between" mb={2} px={2} fontWeight="bold">
            <Text fontSize="xs" width="70%">Address</Text>
            <Text fontSize="xs" textAlign="right">Share %</Text>
          </HStack>
          
          {/* Generate list of addresses and percentages with copy buttons */}
          <VStack align="start" spacing={2} width="100%">
            {shares
              .filter(share => share.address && share.share > 0)
              .map((share, index) => (
                <HStack key={`share-${index}`} width="100%" justifyContent="space-between" p={1} bg="white" borderRadius="md">
                  <HStack width="70%">
                    <Text fontSize="xs" fontFamily="monospace" isTruncated maxW="80%">
                      {share.address}
                    </Text>
                    <CopyButton text={share.address} tooltipLabel="Address" />
                  </HStack>
                  <HStack justifyContent="flex-end">
                    <Text fontSize="xs" fontWeight="medium">
                      {share.share.toFixed(2)}%
                    </Text>
                    <CopyButton text={`${share.share.toFixed(2)}`} tooltipLabel="Share percentage" />
                  </HStack>
                </HStack>
              ))
            }
            
            {/* Creator address if not already included */}
            {creatorAddress && creatorShare > 0 && 
              !shares.some(share => share.address === creatorAddress) && (
                <HStack width="100%" justifyContent="space-between" p={1} bg="white" borderRadius="md">
                  <HStack width="70%">
                    <Text fontSize="xs" fontFamily="monospace" isTruncated maxW="80%">
                      {creatorAddress} <Badge colorScheme="purple" ml={1} fontSize="2xs">Creator</Badge>
                    </Text>
                    <CopyButton text={creatorAddress} tooltipLabel="Creator address" />
                  </HStack>
                  <HStack justifyContent="flex-end">
                    <Text fontSize="xs" fontWeight="medium">
                      {creatorShare.toFixed(2)}%
                    </Text>
                    <CopyButton text={`${creatorShare.toFixed(2)}`} tooltipLabel="Creator share" />
                  </HStack>
                </HStack>
              )
            }
          </VStack>
        </Box>
      )}
      
      {/* Instructions Modal */}
      <Modal isOpen={showInstructionsModal} onClose={() => setShowInstructionsModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>How to Use with OBJKT</ModalHeader>
          <ModalCloseButton />
          <ModalBody whiteSpace="pre-line">
            {instructionsText}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={() => setShowInstructionsModal(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default ExportRoyaltyData; 