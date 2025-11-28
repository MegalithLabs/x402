// Megalith x402 - Signer
// Creates a wallet signer for x402 payments
// Supports both simple private key and viem wallet clients
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Network configurations with env var overrides
const NETWORKS = {
  'base': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: process.env.RPC_BASE || 'https://mainnet.base.org/'
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org/'
  },
  'bsc': {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    rpcUrl: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org/'
  },
  'bsc-testnet': {
    name: 'BNB Chain Testnet',
    chainId: 97,
    rpcUrl: process.env.RPC_BSC_TESTNET || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
  }
};

/**
 * Create a signer for x402 payments
 *
 * Supports two approaches:
 * 1. Simple: Pass network name + private key (+ optional options)
 * 2. Advanced: Pass a viem WalletClient (for hardware wallets, WalletConnect, etc.)
 *
 * @param {string|Object} networkOrWalletClient - Network name OR viem WalletClient
 * @param {string} [privateKey] - Private key (only if first arg is network name)
 * @param {Object} [options] - Options (only if first arg is network name)
 * @param {string} [options.rpcUrl] - Custom RPC URL (overrides env var and default)
 * @returns {Promise<Object>} Signer object
 *
 * @example Simple approach (private key)
 * const signer = await createSigner('base', '0xabc123...');
 *
 * @example With custom RPC
 * const signer = await createSigner('base', '0xabc123...', {
 *   rpcUrl: 'https://my-private-node.com'
 * });
 *
 * @example Using environment variables
 * // Set RPC_BASE=https://my-private-node.com in .env
 * const signer = await createSigner('base', '0xabc123...');
 *
 * @example Advanced approach (viem wallet client)
 * import { createWalletClient, http } from 'viem';
 * import { base } from 'viem/chains';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const walletClient = createWalletClient({
 *   account: privateKeyToAccount('0x...'),
 *   chain: base,
 *   transport: http('https://my-private-node.com')  // Custom RPC here
 * });
 * const signer = await createSigner(walletClient);
 */
async function createSigner(networkOrWalletClient, privateKey, options = {}) {
  // Detect if first argument is a viem WalletClient
  if (isViemWalletClient(networkOrWalletClient)) {
    return createSignerFromViemClient(networkOrWalletClient);
  }

  // Otherwise, treat as network + privateKey approach
  return createSignerFromPrivateKey(networkOrWalletClient, privateKey, options);
}

/**
 * Check if object is a viem WalletClient
 * @private
 */
function isViemWalletClient(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.signTypedData === 'function' &&
    obj.account &&
    obj.chain
  );
}

/**
 * Create signer from viem WalletClient
 * @private
 */
async function createSignerFromViemClient(walletClient) {
  const { createPublicClient, http } = require('viem');

  const account = walletClient.account;
  const chain = walletClient.chain;

  if (!account) {
    throw new Error('WalletClient must have an account configured');
  }
  if (!chain) {
    throw new Error('WalletClient must have a chain configured');
  }

  // Map viem chain to our network name
  const networkName = getNetworkNameFromChainId(chain.id);

  // Create public client for read operations
  const publicClient = createPublicClient({
    chain,
    transport: http()
  });

  return {
    /**
     * Sign an EIP-712 typed data payment
     */
    async signTypedData(domain, types, message) {
      // viem uses slightly different format - needs primaryType
      const primaryType = Object.keys(types)[0];

      return await walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType,
        message
      });
    },

    /**
     * Get the wallet address
     */
    getAddress() {
      return account.address;
    },

    /**
     * Get network info
     */
    getNetwork() {
      return {
        name: networkName,
        chainId: chain.id,
        displayName: chain.name
      };
    },

    /**
     * Get the underlying viem wallet client (advanced use)
     */
    getWalletClient() {
      return walletClient;
    },

    /**
     * Get the public client for read operations
     */
    getPublicClient() {
      return publicClient;
    },

    /**
     * Get a provider-like interface for ethers compatibility
     */
    getProvider() {
      // Return a minimal ethers-compatible provider wrapper
      return {
        async call(tx) {
          return await publicClient.call({
            to: tx.to,
            data: tx.data
          });
        },
        getNetwork() {
          return { chainId: chain.id };
        }
      };
    },

    /**
     * Indicates this signer uses viem
     */
    isViem: true
  };
}

/**
 * Create signer from private key (original simple approach)
 * @private
 */
async function createSignerFromPrivateKey(network, privateKey, options = {}) {
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
  // Priority: explicit option > env var > default
  const rpcUrl = options.rpcUrl || networkConfig.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
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
    },

    /**
     * Indicates this signer uses ethers
     */
    isViem: false
  };
}

/**
 * Map chain ID to our network name
 * @private
 */
function getNetworkNameFromChainId(chainId) {
  for (const [name, config] of Object.entries(NETWORKS)) {
    if (config.chainId === chainId) {
      return name;
    }
  }
  throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(NETWORKS).join(', ')}`);
}

module.exports = {
  createSigner,
  NETWORKS
};
