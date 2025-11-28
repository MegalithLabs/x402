// Megalith x402 - Payer Functions
// Wrap HTTP clients to automatically handle 402 Payment Required responses
// Supports both ethers and viem signers
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Default facilitator
const DEFAULT_FACILITATOR = 'https://x402.megalithlabs.ai';

/**
 * Cross-platform base64 encode (works in Node.js and browsers)
 * @private
 */
function base64Encode(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  return btoa(str);
}

/**
 * Cross-platform base64 decode (works in Node.js and browsers)
 * @private
 */
function base64Decode(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString();
  }
  return atob(str);
}

// Token ABI for getting details (ethers format)
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function authorizationState(address, bytes32) view returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// Token ABI for viem
const VIEM_TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'version',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }]
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
];

/**
 * Wrap fetch to automatically handle 402 Payment Required responses
 *
 * @param {Function} fetch - The fetch function to wrap
 * @param {Object} signer - Signer created by createSigner()
 * @param {Object} options - Options
 * @param {string} options.maxAmount - Maximum amount to pay per request (e.g., '0.50')
 * @param {string} options.facilitator - Custom facilitator URL
 * @returns {Function} Wrapped fetch function
 *
 * @example
 * const signer = await createSigner('base', privateKey);
 * const fetchWithPay = x402Fetch(fetch, signer, { maxAmount: '0.50' });
 * const response = await fetchWithPay('https://api.example.com/data');
 */
function x402Fetch(fetch, signer, options = {}) {
  const maxAmount = options.maxAmount ? parseFloat(options.maxAmount) : 0.10;
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;

  return async function fetchWithPayment(url, init = {}) {
    // Make initial request
    let response = await fetch(url, init);

    // If not 402, return as-is
    if (response.status !== 402) {
      return response;
    }

    // Parse payment requirements from response
    const paymentRequired = await response.json();
    const requirements = paymentRequired.paymentRequirements || paymentRequired;

    // Get token decimals and validate amount
    const decimals = await getTokenDecimals(signer, requirements.asset);
    const amount = parseFloat(ethers.formatUnits(requirements.maxAmountRequired || '0', decimals));
    if (amount > maxAmount) {
      throw new Error(`Payment amount ${amount} exceeds maxAmount ${maxAmount}`);
    }

    // Create payment
    const payment = await createPayment(signer, requirements, facilitator);

    // Retry with payment header
    const paymentHeader = base64Encode(JSON.stringify(payment));
    const newInit = {
      ...init,
      headers: {
        ...init.headers,
        'X-PAYMENT': paymentHeader
      }
    };

    return await fetch(url, newInit);
  };
}

/**
 * Wrap axios to automatically handle 402 Payment Required responses
 *
 * @param {Object} axios - Axios instance to wrap
 * @param {Object} signer - Signer created by createSigner()
 * @param {Object} options - Options
 * @param {string} options.maxAmount - Maximum amount to pay per request
 * @param {string} options.facilitator - Custom facilitator URL
 * @returns {Object} Axios instance with payment interceptor
 *
 * @example
 * const signer = await createSigner('base', privateKey);
 * const axiosWithPay = x402Axios(axios.create(), signer, { maxAmount: '0.50' });
 * const response = await axiosWithPay.get('https://api.example.com/data');
 */
function x402Axios(axiosInstance, signer, options = {}) {
  const maxAmount = options.maxAmount ? parseFloat(options.maxAmount) : 0.10;
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;

  // Add response interceptor to handle 402
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status !== 402) {
        throw error;
      }

      const requirements = error.response.data.paymentRequirements || error.response.data;

      // Get token decimals and validate amount
      const decimals = await getTokenDecimals(signer, requirements.asset);
      const amount = parseFloat(ethers.formatUnits(requirements.maxAmountRequired || '0', decimals));
      if (amount > maxAmount) {
        throw new Error(`Payment amount ${amount} exceeds maxAmount ${maxAmount}`);
      }

      // Create payment
      const payment = await createPayment(signer, requirements, facilitator);

      // Retry with payment header
      const paymentHeader = base64Encode(JSON.stringify(payment));
      const config = error.config;
      config.headers['X-PAYMENT'] = paymentHeader;

      return axiosInstance.request(config);
    }
  );

  return axiosInstance;
}

/**
 * Create a signed payment for the given requirements
 * @private
 */
async function createPayment(signer, requirements, facilitator) {
  const network = signer.getNetwork();
  const address = signer.getAddress();

  const tokenAddress = requirements.asset;
  const payTo = requirements.payTo;
  const value = requirements.maxAmountRequired;

  // Get token details - use appropriate method based on signer type
  let tokenName, tokenVersion, isEIP3009;

  if (signer.isViem) {
    const result = await getTokenDetailsViem(signer, tokenAddress, address);
    tokenName = result.tokenName;
    tokenVersion = result.tokenVersion;
    isEIP3009 = result.isEIP3009;
  } else {
    const result = await getTokenDetailsEthers(signer, tokenAddress, address);
    tokenName = result.tokenName;
    tokenVersion = result.tokenVersion;
    isEIP3009 = result.isEIP3009;
  }

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 60;
  const validBefore = now + 3600;

  let signature, authorization;

  if (isEIP3009) {
    // EIP-3009 token (USDC, EURC)
    const nonce = generateRandomBytes32();

    const domain = {
      name: tokenName,
      version: tokenVersion,
      chainId: network.chainId,
      verifyingContract: tokenAddress
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const message = {
      from: address,
      to: payTo,
      value: BigInt(value),
      validAfter,
      validBefore,
      nonce
    };

    signature = await signer.signTypedData(domain, types, message);
    authorization = {
      from: address,
      to: payTo,
      value: value.toString(),
      validAfter,
      validBefore,
      nonce
    };
  } else {
    // Standard ERC-20 via Stargate
    const stargateAddress = await fetchStargateAddress(network.name, facilitator);

    // Check allowance before proceeding
    const allowance = await checkAllowance(signer, tokenAddress, address, stargateAddress);
    if (allowance < BigInt(value)) {
      const error = new Error(
        `Insufficient allowance for ${tokenAddress}. ` +
        `Required: ${value}, Current: ${allowance.toString()}. ` +
        `Use approveToken() to approve the Stargate contract.`
      );
      error.code = 'INSUFFICIENT_ALLOWANCE';
      error.required = value;
      error.current = allowance.toString();
      error.token = tokenAddress;
      error.spender = stargateAddress;
      throw error;
    }

    const nonce = await getStargateNonce(signer, stargateAddress, address, tokenAddress);

    const domain = {
      name: 'Megalith',
      version: '1',
      chainId: network.chainId,
      verifyingContract: stargateAddress
    };

    const types = {
      ERC20Payment: [
        { name: 'token', type: 'address' },
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' }
      ]
    };

    const message = {
      token: tokenAddress,
      from: address,
      to: payTo,
      value: BigInt(value),
      nonce,
      validAfter,
      validBefore
    };

    signature = await signer.signTypedData(domain, types, message);
    authorization = {
      from: address,
      to: payTo,
      value: value.toString(),
      validAfter,
      validBefore,
      nonce: nonce.toString()
    };
  }

  // Format as x402 payload
  return {
    x402Version: 1,
    scheme: 'exact',
    network: network.name,
    payload: {
      signature,
      authorization
    }
  };
}

/**
 * Get token details using ethers provider
 * @private
 */
async function getTokenDetailsEthers(signer, tokenAddress, address) {
  const provider = signer.getProvider();
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

  let tokenName, tokenVersion;

  try {
    tokenName = await token.name();
  } catch (e) {
    throw new Error('Failed to get token name');
  }

  try {
    tokenVersion = await token.version();
  } catch (e) {
    tokenVersion = '1';
  }

  // Check if EIP-3009 token
  let isEIP3009 = false;
  try {
    const testNonce = ethers.hexlify(ethers.randomBytes(32));
    await token.authorizationState(address, testNonce);
    isEIP3009 = true;
  } catch (e) {
    isEIP3009 = false;
  }

  return { tokenName, tokenVersion, isEIP3009 };
}

/**
 * Get token details using viem public client
 * @private
 */
async function getTokenDetailsViem(signer, tokenAddress, address) {
  const publicClient = signer.getPublicClient();

  let tokenName, tokenVersion;

  try {
    tokenName = await publicClient.readContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'name'
    });
  } catch (e) {
    throw new Error('Failed to get token name');
  }

  try {
    tokenVersion = await publicClient.readContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'version'
    });
  } catch (e) {
    tokenVersion = '1';
  }

  // Check if EIP-3009 token
  let isEIP3009 = false;
  try {
    const testNonce = generateRandomBytes32();
    await publicClient.readContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'authorizationState',
      args: [address, testNonce]
    });
    isEIP3009 = true;
  } catch (e) {
    isEIP3009 = false;
  }

  return { tokenName, tokenVersion, isEIP3009 };
}

// Decimals cache to avoid repeated RPC calls
const decimalsCache = {};

/**
 * Get token decimals (with caching)
 * @private
 */
async function getTokenDecimals(signer, tokenAddress) {
  if (decimalsCache[tokenAddress] !== undefined) {
    return decimalsCache[tokenAddress];
  }

  let decimals;
  if (signer.isViem) {
    const publicClient = signer.getPublicClient();
    decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'decimals'
    });
  } else {
    const provider = signer.getProvider();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
    decimals = await token.decimals();
  }

  decimalsCache[tokenAddress] = Number(decimals);
  return decimalsCache[tokenAddress];
}

/**
 * Check token allowance for Stargate contract
 * @private
 */
async function checkAllowance(signer, tokenAddress, ownerAddress, spenderAddress) {
  if (signer.isViem) {
    const publicClient = signer.getPublicClient();
    return await publicClient.readContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress]
    });
  } else {
    const provider = signer.getProvider();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
    return await token.allowance(ownerAddress, spenderAddress);
  }
}

/**
 * Approve a token for use with x402 payments
 *
 * Required for standard ERC-20 tokens (not needed for EIP-3009 tokens like USDC)
 *
 * @param {Object} signer - Signer created by createSigner()
 * @param {string} tokenAddress - Token contract address
 * @param {Object} options - Options
 * @param {string} options.amount - Amount to approve (default: unlimited)
 * @param {string} options.facilitator - Custom facilitator URL
 * @returns {Promise<Object>} Transaction receipt
 *
 * @example
 * // Approve unlimited
 * const receipt = await approveToken(signer, '0x...');
 *
 * // Approve specific amount
 * const receipt = await approveToken(signer, '0x...', { amount: '1000000000' });
 */
async function approveToken(signer, tokenAddress, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;
  const network = signer.getNetwork();
  const address = signer.getAddress();

  // Get Stargate address
  const stargateAddress = await fetchStargateAddress(network.name, facilitator);

  // Determine approval amount (default: unlimited)
  const amount = options.amount ? BigInt(options.amount) : ethers.MaxUint256;

  if (signer.isViem) {
    // viem approach - need wallet client with writeContract
    const walletClient = signer.getWalletClient();
    const publicClient = signer.getPublicClient();

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: VIEM_TOKEN_ABI,
      functionName: 'approve',
      args: [stargateAddress, amount]
    });

    // Wait for transaction
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' ? 1 : 0,
      spender: stargateAddress,
      amount: amount.toString()
    };
  } else {
    // ethers approach
    const wallet = signer.getWallet();
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, wallet);

    const tx = await token.approve(stargateAddress, amount);
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      spender: stargateAddress,
      amount: amount.toString()
    };
  }
}

/**
 * Get Stargate nonce for ERC-20 payments
 * @private
 */
async function getStargateNonce(signer, stargateAddress, userAddress, tokenAddress) {
  if (signer.isViem) {
    const publicClient = signer.getPublicClient();
    return await publicClient.readContract({
      address: stargateAddress,
      abi: [{
        name: 'getNonce',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'user', type: 'address' },
          { name: 'token', type: 'address' }
        ],
        outputs: [{ type: 'uint256' }]
      }],
      functionName: 'getNonce',
      args: [userAddress, tokenAddress]
    });
  } else {
    const provider = signer.getProvider();
    const stargateABI = ['function getNonce(address user, address token) view returns (uint256)'];
    const stargate = new ethers.Contract(stargateAddress, stargateABI, provider);
    return await stargate.getNonce(userAddress, tokenAddress);
  }
}

/**
 * Generate random 32 bytes as hex string
 * @private
 */
function generateRandomBytes32() {
  // Use crypto if available, otherwise ethers
  try {
    const crypto = require('crypto');
    return '0x' + crypto.randomBytes(32).toString('hex');
  } catch (e) {
    return ethers.hexlify(ethers.randomBytes(32));
  }
}

/**
 * Fetch Stargate contract address from facilitator
 * @private
 */
async function fetchStargateAddress(network, facilitator) {
  const response = await fetch(`${facilitator}/contracts`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Stargate address: ${response.status}`);
  }
  const contracts = await response.json();
  if (!contracts[network]) {
    throw new Error(`Network ${network} not supported`);
  }
  return contracts[network].stargate;
}

module.exports = {
  x402Fetch,
  x402Axios,
  approveToken,
  DEFAULT_FACILITATOR
};
