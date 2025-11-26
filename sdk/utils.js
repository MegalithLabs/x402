// Megalith x402 SDK - Utility Functions
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Default facilitator API
const DEFAULT_FACILITATOR_URL = 'https://x402.megalithlabs.ai';

// Network configurations
const NETWORK_CONFIG = {
  'bsc': {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org/'
  },
  'bsc-testnet': {
    name: 'BNB Chain Testnet',
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
  },
  'base': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org/'
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org/'
  }
};

// Token ABI for detecting type and getting details
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function authorizationState(address, bytes32) view returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Stargate ABI for nonce fetching
const STARGATE_ABI = [
  'function getNonce(address user, address token) view returns (uint256)'
];

/**
 * Check if a token supports EIP-3009 (transferWithAuthorization)
 * @param {ethers.Contract} tokenContract - Token contract instance
 * @param {string} address - Address to check authorization state for
 * @returns {Promise<boolean>} - True if EIP-3009 supported
 */
async function isEIP3009Token(tokenContract, address) {
  try {
    const testNonce = ethers.hexlify(ethers.randomBytes(32));
    await tokenContract.authorizationState(address, testNonce);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Generate a random bytes32 nonce for EIP-3009 tokens
 * @returns {string} - Random 32-byte hex string
 */
function generateRandomNonce() {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Get sequential nonce from Stargate contract for ERC-20 tokens
 * @param {ethers.Provider} provider - Ethers provider
 * @param {string} stargateAddress - Stargate contract address
 * @param {string} userAddress - User's wallet address
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<bigint>} - Current nonce
 */
async function getStargateNonce(provider, stargateAddress, userAddress, tokenAddress) {
  const stargate = new ethers.Contract(stargateAddress, STARGATE_ABI, provider);
  return await stargate.getNonce(userAddress, tokenAddress);
}

/**
 * Get token details (name, version, symbol, decimals)
 * @param {ethers.Contract} tokenContract - Token contract instance
 * @returns {Promise<Object>} - Token details
 */
async function getTokenDetails(tokenContract) {
  const details = {
    name: null,
    version: '1',
    symbol: null,
    decimals: 18
  };

  try {
    details.name = await tokenContract.name();
  } catch (e) {
    throw new Error('Failed to fetch token name - is this a valid token address?');
  }

  try {
    details.version = await tokenContract.version();
  } catch (e) {
    // version() not available, use default
  }

  try {
    details.symbol = await tokenContract.symbol();
  } catch (e) {
    // symbol not available
  }

  try {
    details.decimals = await tokenContract.decimals();
  } catch (e) {
    // decimals not available, use default 18
  }

  return details;
}

/**
 * Fetch Stargate contract address from facilitator API
 * @param {string} network - Network name (bsc, base, etc.)
 * @param {string} facilitatorUrl - Facilitator API URL
 * @returns {Promise<string>} - Stargate contract address
 */
async function fetchStargateContract(network, facilitatorUrl = DEFAULT_FACILITATOR_URL) {
  const response = await fetch(`${facilitatorUrl}/contracts`);

  if (!response.ok) {
    throw new Error(`Facilitator API returned ${response.status}`);
  }

  const contracts = await response.json();

  if (!contracts[network]) {
    throw new Error(`Network ${network} not supported by facilitator`);
  }

  return contracts[network].stargate;
}

/**
 * Check token allowance for Stargate contract
 * @param {ethers.Contract} tokenContract - Token contract instance
 * @param {string} ownerAddress - Token owner address
 * @param {string} stargateAddress - Stargate contract address
 * @returns {Promise<bigint>} - Current allowance
 */
async function checkAllowance(tokenContract, ownerAddress, stargateAddress) {
  return await tokenContract.allowance(ownerAddress, stargateAddress);
}

/**
 * Get token balance
 * @param {ethers.Contract} tokenContract - Token contract instance
 * @param {string} address - Address to check balance for
 * @returns {Promise<bigint>} - Balance in base units
 */
async function getBalance(tokenContract, address) {
  return await tokenContract.balanceOf(address);
}

module.exports = {
  DEFAULT_FACILITATOR_URL,
  NETWORK_CONFIG,
  TOKEN_ABI,
  STARGATE_ABI,
  isEIP3009Token,
  generateRandomNonce,
  getStargateNonce,
  getTokenDetails,
  fetchStargateContract,
  checkAllowance,
  getBalance
};
