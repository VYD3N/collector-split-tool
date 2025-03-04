/**
 * Utility functions for formatting values
 */

/**
 * Format a Tezos address to show a shortened version
 * @param address The full Tezos address
 * @returns The formatted address (e.g., tz1abc...xyz)
 */
export const formatAddress = (address: string): string => {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/**
 * Format a tez value for display, handling null and undefined values
 */
export const formatTez = (amount: number | null | undefined): string => {
  // Handle null, undefined, NaN, or negative values
  if (amount === null || amount === undefined || isNaN(amount) || amount < 0) {
    return '0.00 ₮';
  }
  
  // Round to two decimal places for display
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Format the number with commas for thousands separators
  const formattedNumber = roundedAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Add tez symbol and return
  return `${formattedNumber} ₮`;
};

/**
 * Format a percentage with % symbol
 * @param value The percentage value (e.g., 0.15 for 15%)
 * @param multiply If true, multiply by 100 (e.g., 0.15 -> 15)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, multiply = true): string => {
    const displayValue = multiply ? value * 100 : value;
    return `${displayValue.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2
    })}%`;
};

/**
 * Format a date to a readable string
 * @param date The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Format a transaction hash to a shortened version
 * @param hash The transaction hash
 * @returns The formatted hash (e.g., o123...abc)
 */
export const formatTransactionHash = (hash: string): string => {
    if (!hash) return '';
    if (hash.length < 12) return hash;
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 6)}`;
}; 