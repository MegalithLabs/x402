// Megalith x402 - Signer
// Creates a wallet signer for x402 payments
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Network configurations
const NETWORKS = {
  'base': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org/'
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org/'
  },
  'bsc': {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org/'
  },
  'bsc-testnet': {
    name: 'BNB Chain Testnet',
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
  }
};

/**
 * Create a signer for x402 payments
 *
 * @param {string} network - Network name: 'base', 'base-sepolia', 'bsc', 'bsc-testnet'
 * @param {string} privateKey - Wallet private key (hex string starting with 0x)
 * @returns {Promise<Object>} Signer object with signPayment, getAddress, network
 *
 * @example
 * const signer = await createSigner('base', '0xabc123...');
 */
async function createSigner(network, privateKey) {
  if (!network) {
    throw new Error('network is required');
  }
  if (!privateKey) {
    throw new Error('privateKey is required');
  }
  if (!NETWORKS[network]) {
    throw new Error(`Invalid network: ${network}. Supported: ${Object.keys(NETWORKS).join(', ')}`);
  }

  const networkConfig = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  return {
    /**
     * Sign an EIP-712 typed data payment
     */
    async signTypedData(domain, types, message) {
      return await wallet.signTypedData(domain, types, message);
    },

    /**
     * Get the wallet address
     */
    getAddress() {
      return wallet.address;
    },

    /**
     * Get network info
     */
    getNetwork() {
      return {
        name: network,
        chainId: networkConfig.chainId,
        displayName: networkConfig.name
      };
    },

    /**
     * Get the underlying ethers wallet (advanced use)
     */
    getWallet() {
      return wallet;
    },

    /**
     * Get the provider
     */
    getProvider() {
      return provider;
    }
  };
}

module.exports = {
  createSigner,
  NETWORKS
};
