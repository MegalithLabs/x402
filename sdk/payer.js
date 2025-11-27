// Megalith x402 - Payer Functions
// Wrap HTTP clients to automatically handle 402 Payment Required responses
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Default facilitator
const DEFAULT_FACILITATOR = 'https://x402.megalithlabs.ai';

// Token ABI for getting details
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function authorizationState(address, bytes32) view returns (bool)'
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

    // Validate amount
    const amount = parseFloat(ethers.formatUnits(requirements.maxAmountRequired || '0', 6));
    if (amount > maxAmount) {
      throw new Error(`Payment amount ${amount} exceeds maxAmount ${maxAmount}`);
    }

    // Create payment
    const payment = await createPayment(signer, requirements, facilitator);

    // Retry with payment header
    const paymentHeader = Buffer.from(JSON.stringify(payment)).toString('base64');
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

      // Validate amount
      const amount = parseFloat(ethers.formatUnits(requirements.maxAmountRequired || '0', 6));
      if (amount > maxAmount) {
        throw new Error(`Payment amount ${amount} exceeds maxAmount ${maxAmount}`);
      }

      // Create payment
      const payment = await createPayment(signer, requirements, facilitator);

      // Retry with payment header
      const paymentHeader = Buffer.from(JSON.stringify(payment)).toString('base64');
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
  const provider = signer.getProvider();

  const tokenAddress = requirements.asset;
  const payTo = requirements.payTo;
  const value = requirements.maxAmountRequired;

  // Get token details
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

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 60;
  const validBefore = now + 3600;

  let signature, authorization;

  if (isEIP3009) {
    // EIP-3009 token (USDC, EURC)
    const nonce = ethers.hexlify(ethers.randomBytes(32));

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

    const stargateABI = ['function getNonce(address user, address token) view returns (uint256)'];
    const stargate = new ethers.Contract(stargateAddress, stargateABI, provider);
    const nonce = await stargate.getNonce(address, tokenAddress);

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
  DEFAULT_FACILITATOR
};
