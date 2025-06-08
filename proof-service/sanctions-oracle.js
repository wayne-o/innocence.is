const { ethers } = require('ethers');

/**
 * Sanctions Oracle Service
 * 
 * This service maintains a list of sanctioned addresses and provides
 * an API to check if an address is sanctioned. In production, this would
 * integrate with real sanctions lists (OFAC, EU, etc.)
 */

// Known sanctioned addresses (example list)
const SANCTIONED_ADDRESSES = new Set([
  // Tornado Cash addresses (real sanctioned addresses)
  '0x8589427373D6D84E98730D7795D8f6f8731FDA16'.toLowerCase(),
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967'.toLowerCase(),
  '0xDD4c48C0B24039969fC16D1cdF626eaB821d3384'.toLowerCase(),
  '0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3'.toLowerCase(),
  '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF'.toLowerCase(),
  '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291'.toLowerCase(),
  
  // Lazarus Group addresses
  '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'.toLowerCase(),
  '0xa0e1c89Ef1a489c9C7dE96311eD5Ce5D32c20E4B'.toLowerCase(),
  '0x3Cffd56B47B7b41c56258D9C7731ABaDc360E073'.toLowerCase(),
  '0x53b6936513e738f44FB50d2b9476730C0Ab3Bfc1'.toLowerCase()
]);

class SanctionsOracle {
  constructor() {
    this.sanctionedAddresses = SANCTIONED_ADDRESSES;
    this.lastUpdate = Date.now();
  }

  /**
   * Check if an address is sanctioned
   * @param {string} address - Ethereum address to check
   * @returns {boolean} - True if sanctioned, false otherwise
   */
  isSanctioned(address) {
    if (!address || !ethers.isAddress(address)) {
      throw new Error('Invalid Ethereum address');
    }
    
    return this.sanctionedAddresses.has(address.toLowerCase());
  }

  /**
   * Get the current Merkle root of the sanctions list
   * In production, this would be a real Merkle tree
   * @returns {string} - Merkle root as hex string
   */
  getSanctionsRoot() {
    // For now, return a deterministic hash based on the list
    const addresses = Array.from(this.sanctionedAddresses).sort();
    const data = addresses.join('');
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  /**
   * Add an address to the sanctions list (admin only)
   * @param {string} address - Address to sanction
   */
  addSanction(address) {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid Ethereum address');
    }
    
    this.sanctionedAddresses.add(address.toLowerCase());
    this.lastUpdate = Date.now();
  }

  /**
   * Remove an address from the sanctions list (admin only)
   * @param {string} address - Address to remove from sanctions
   */
  removeSanction(address) {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid Ethereum address');
    }
    
    this.sanctionedAddresses.delete(address.toLowerCase());
    this.lastUpdate = Date.now();
  }

  /**
   * Get sanctions status with proof data
   * @param {string} address - Address to check
   * @returns {object} - Sanctions status and proof data
   */
  getSanctionsStatus(address) {
    const isSanctioned = this.isSanctioned(address);
    const sanctionsRoot = this.getSanctionsRoot();
    
    return {
      address,
      isSanctioned,
      sanctionsRoot,
      timestamp: Date.now(),
      totalSanctioned: this.sanctionedAddresses.size,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Get list of all sanctioned addresses (for transparency)
   * @returns {string[]} - Array of sanctioned addresses
   */
  getAllSanctioned() {
    return Array.from(this.sanctionedAddresses);
  }
}

// Export singleton instance
module.exports = new SanctionsOracle();