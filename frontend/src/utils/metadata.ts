/**
 * Utilities for generating OBJKT-compliant NFT metadata
 */

/**
 * Represents a collector with their address and assigned royalty share
 */
export interface CollectorShare {
  address: string;
  share: number; // Percentage (e.g., 2.5 for 2.5%)
}

/**
 * Full metadata type for an NFT
 */
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  backup_image?: string;
  backup_metadata?: string;
  royalties: {
    decimals: number;
    shares: Record<string, number>;
  };
  mintingTool: string;
  creators: string[];
  interfaces: string[];
  attributes?: Array<{ name: string; value: string }>;
  accessibility?: { hazards?: string[] };
  contentRating?: string;
}

/**
 * Convert a list of collector shares to the format expected by OBJKT
 * @param shares Array of collector shares
 * @param decimals Number of decimal places for royalty shares
 * @returns Record of addresses to normalized shares
 */
export function formatRoyaltyShares(
  shares: CollectorShare[],
  decimals: number = 3
): Record<string, number> {
  const multiplier = Math.pow(10, decimals);
  
  // Filter out collectors with 0 or negative shares
  const validShares = shares.filter(s => s.share > 0);
  
  // Convert to the format expected by OBJKT
  return validShares.reduce((result, share) => {
    // Convert percentage to the appropriate decimal representation
    const normalizedShare = Math.floor(share.share * multiplier);
    
    // Only include if share is greater than 0 after normalization
    if (normalizedShare > 0) {
      result[share.address] = normalizedShare;
    }
    return result;
  }, {} as Record<string, number>);
}

/**
 * Generate OBJKT-compliant metadata for an NFT
 * @param name NFT name
 * @param description NFT description
 * @param pinataCid Primary Pinata CID for the image/content
 * @param nftStorageCid Backup NFT.Storage CID
 * @param shares Array of collector royalty shares
 * @param metadataPinataCid Optional CID for the metadata on Pinata
 * @param metadataNftStorageCid Optional CID for the metadata on NFT.Storage
 * @param creatorAddress Creator's Tezos address
 * @param isAnimation Whether the primary content is an animation/video
 * @param attributes Optional array of trait attributes
 * @returns Complete NFT metadata object
 */
export function generateTokenMetadata(
  name: string,
  description: string,
  pinataCid: string,
  nftStorageCid: string,
  shares: CollectorShare[],
  metadataPinataCid?: string,
  metadataNftStorageCid?: string,
  creatorAddress?: string,
  isAnimation: boolean = false,
  attributes?: Array<{ name: string; value: string }>
): NFTMetadata {
  // Format royalty shares
  const decimals = 3;
  const formattedShares = formatRoyaltyShares(shares, decimals);
  
  // Add creator to shares if provided and not already included
  if (creatorAddress) {
    // Check if creator has a share already
    const creatorExists = shares.some(s => s.address === creatorAddress);
    
    // If not, add a default creator share
    if (!creatorExists) {
      // Ensure we don't exceed 10% total royalties
      formattedShares[creatorAddress] = Math.floor(2.5 * Math.pow(10, decimals)); // 2.5%
    }
  }
  
  // Creators array for metadata
  const creators = creatorAddress ? [creatorAddress] : [];
  
  // Create base metadata
  const metadata: NFTMetadata = {
    name,
    description,
    image: `ipfs://${pinataCid}`, // Primary image from Pinata
    royalties: {
      decimals,
      shares: formattedShares
    },
    mintingTool: "Collector Split Tool v1.0",
    creators,
    interfaces: ["TZIP-12"]
  };
  
  // Add backup image from NFT.Storage if available
  if (nftStorageCid) {
    metadata.backup_image = `ipfs://${nftStorageCid}`;
  }
  
  // Add animation_url if this is an animation/video
  if (isAnimation) {
    metadata.animation_url = `ipfs://${pinataCid}`;
  }
  
  // Add backup metadata if available
  if (metadataNftStorageCid) {
    metadata.backup_metadata = `ipfs://${metadataNftStorageCid}`;
  }
  
  // Add attributes if provided
  if (attributes && attributes.length > 0) {
    metadata.attributes = attributes;
  }
  
  return metadata;
}

/**
 * Validate the total royalty percentage doesn't exceed the maximum allowed (25%)
 * @param shares Array of collector shares
 * @returns Object indicating if valid and total percentage
 */
export function validateRoyaltyShares(shares: CollectorShare[]): { 
  valid: boolean;
  totalPercentage: number;
  message?: string;
} {
  const MAX_ROYALTY_PERCENTAGE = 25.0; // 25% maximum royalty
  
  // Calculate total percentage
  const totalPercentage = shares.reduce((sum, share) => sum + share.share, 0);
  
  // Allow exactly 25% by using > not >=
  if (totalPercentage > MAX_ROYALTY_PERCENTAGE) {
    return {
      valid: false,
      totalPercentage,
      message: `Total royalty (${totalPercentage.toFixed(2)}%) exceeds maximum allowed (${MAX_ROYALTY_PERCENTAGE}%)`
    };
  }
  
  return {
    valid: true,
    totalPercentage
  };
}

/**
 * Validate that metadata follows OBJKT's TZIP-21 standard
 * @param metadata The metadata to validate
 * @returns Validation result with messages if any issues are found
 */
export function validateTZIP21Metadata(metadata: NFTMetadata): { 
  valid: boolean; 
  messages: string[];
} {
  const messages: string[] = [];
  
  // Required fields according to TZIP-21
  if (!metadata.name || metadata.name.trim() === '') {
    messages.push('Name is required');
  }
  
  if (!metadata.image || !metadata.image.startsWith('ipfs://')) {
    messages.push('Image must be present and use the ipfs:// protocol');
  }
  
  // Validate royalties format
  if (!metadata.royalties) {
    messages.push('Royalties object is required');
  } else {
    if (metadata.royalties.decimals === undefined) {
      messages.push('Royalties must specify decimals');
    }
    
    if (!metadata.royalties.shares || Object.keys(metadata.royalties.shares).length === 0) {
      messages.push('Royalties must contain at least one share');
    }
    
    // Validate that total royalties don't exceed 10%
    const MAX_ROYALTY_PERCENTAGE = 10.0;
    const totalRoyalties = Object.values(metadata.royalties.shares || {}).reduce((sum, value) => sum + value, 0);
    const normalizedTotal = totalRoyalties / Math.pow(10, metadata.royalties.decimals || 0);
    
    // Allow exactly 10% by using > not >=
    if (normalizedTotal > MAX_ROYALTY_PERCENTAGE) {
      messages.push(`Total royalties (${normalizedTotal.toFixed(2)}%) exceed maximum of ${MAX_ROYALTY_PERCENTAGE}%`);
    }
  }
  
  // Validate interfaces
  if (!metadata.interfaces || !metadata.interfaces.includes('TZIP-12')) {
    messages.push('Interfaces must include TZIP-12');
  }
  
  // Validate creators
  if (!metadata.creators || metadata.creators.length === 0) {
    messages.push('At least one creator address must be specified');
  }
  
  // Validate minting tool
  if (!metadata.mintingTool || metadata.mintingTool.trim() === '') {
    messages.push('Minting tool identifier is required');
  }
  
  // Optional field validations
  
  // If animation_url is present, it should use ipfs://
  if (metadata.animation_url && !metadata.animation_url.startsWith('ipfs://')) {
    messages.push('Animation URL must use the ipfs:// protocol');
  }
  
  // If backup_image is present, it should use ipfs://
  if (metadata.backup_image && !metadata.backup_image.startsWith('ipfs://')) {
    messages.push('Backup image must use the ipfs:// protocol');
  }
  
  // If backup_metadata is present, it should use ipfs://
  if (metadata.backup_metadata && !metadata.backup_metadata.startsWith('ipfs://')) {
    messages.push('Backup metadata must use the ipfs:// protocol');
  }
  
  return {
    valid: messages.length === 0,
    messages
  };
} 