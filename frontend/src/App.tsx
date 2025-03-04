import React, { useState } from 'react';
import { ChakraProvider, Box, VStack, Container, Heading, useToast } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { CollectorRanking } from './components/CollectorRanking';
import { SplitConfiguration } from './components/SplitConfiguration';
import { Collector } from './types/collector';
import { SpeedInsights } from "@vercel/speed-insights/react";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

function App() {
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const toast = useToast();

  const handleCollectorsLoaded = (collectors: Collector[]) => {
    setCollectors(collectors);
  };

  return (
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <Box minH="100vh" bg="gray.50">
          <Container maxW="container.lg" py={6}>
            <VStack spacing={6} align="stretch">
              {/* Header */}
              <Box p={4} bg="white" borderRadius="lg" shadow="sm">
                <VStack spacing={4}>
                  <Heading size="lg" textAlign="center">
                    Tezos Collector Split Tool
                  </Heading>
                </VStack>
              </Box>

              {/* Main Content */}
              <Box bg="white" borderRadius="lg" shadow="sm" overflow="hidden">
                <VStack spacing={0} align="stretch" divider={<Box borderBottom="1px" borderColor="gray.200" />}>
                  <CollectorRanking onCollectorsLoaded={handleCollectorsLoaded} />
                  <SplitConfiguration collectors={collectors} />
                </VStack>
              </Box>
            </VStack>
          </Container>
        </Box>
        <SpeedInsights />
      </QueryClientProvider>
    </ChakraProvider>
  );
}

export default App;
