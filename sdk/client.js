// Megalith x402 SDK - Main Client
// https://megalithlabs.ai

const { ethers } = require('ethers');
const {
  DEFAULT_FACILITATOR_URL,
  NETWORK_CONFIG,
  TOKEN_ABI,
  isEIP3009Token,
  generateRandomNonce,
  getStargateNonce,
  getTokenDetails,
  fetchStargateContract,
  checkAllowance,
  getBalance
} = require('./utils');

/**
 * X402Client - Create and settle x402-compliant payments
 *
 * @example
 * const client = new X402Client({ privateKey: '0x...', network: 'base' });
 * const result = await client.pay({ to: '0x...', amount: '1.00', token: '0x...' });
 */
class X402Client {
  /**
   * Create a new X402Client
   * @param {Object} config - Configuration options
   * @param {string} config.privateKey - Wallet private key
   * @param {string} config.network - Network name: 'bsc', 'bsc-testnet', 'base', 'base-sepolia'
   * @param {string} [config.facilitatorUrl] - Custom facilitator URL (default: https://x402.megalithlabs.ai)
   * @param {string} [config.rpcUrl] - Custom RPC URL (overrides default for network)
   */
  constructor({ privateKey, network, facilitatorUrl, rpcUrl }) {
    if (!privateKey) {
      throw new Error('privateKey is required');
    }
    if (!network) {
      throw new Error('network is required');
    }
    if (!NETWORK_CONFIG[network]) {
      throw new Error(`Invalid network: ${network}. Supported: ${Object.keys(NETWORK_CONFIG).join(', ')}`);
    }

    this.network = network;
    this.networkConfig = NETWORK_CONFIG[network];
    this.facilitatorUrl = facilitatorUrl || DEFAULT_FACILITATOR_URL;

    const selectedRpcUrl = rpcUrl || this.networkConfig.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(selectedRpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Get the wallet address
   * @returns {string} - Wallet address
   */
  getAddress() {
    return this.wallet.address;
  }

  /**
   * Get network info
   * @returns {Object} - Network configuration
   */
  getNetworkInfo() {
    return {
      name: this.networkConfig.name,
      network: this.network,
      chainId: this.networkConfig.chainId
    };
  }

  /**
   * Create and settle a payment in one call
   * @param {Object} options - Payment options
   * @param {string} options.to - Recipient address
   * @param {string} options.amount - Amount as decimal string (e.g., '1.50')
   * @param {string} options.token - Token contract address
   * @returns {Promise<Object>} - Settlement result from facilitator
   */
  async pay({ to, amount, token }) {
    const payload = await this.createPayment({ to, amount, token });
    return await this.settlePayment(payload);
  }

  /**
   * Create a signed payment payload without settling
   * @param {Object} options - Payment options
   * @param {string} options.to - Recipient address
   * @param {string} options.amount - Amount as decimal string (e.g., '1.50')
   * @param {string} options.token - Token contract address
   * @returns {Promise<Object>} - x402-compliant payment payload
   */
  async createPayment({ to, amount, token }) {
    if (!to || !amount || !token) {
      throw new Error('to, amount, and token are required');
    }

    // Normalize addresses
    const toAddress = ethers.getAddress(to);
    const tokenAddress = ethers.getAddress(token);

    // Create token contract instance
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, this.provider);

    // Get token details
    const tokenDetails = await getTokenDetails(tokenContract);

    // Parse amount to base units
    const value = ethers.parseUnits(amount, tokenDetails.decimals);

    // Check balance
    const balance = await getBalance(tokenContract, this.wallet.address);
    if (balance < value) {
      throw new Error(
        `Insufficient balance. Have: ${ethers.formatUnits(balance, tokenDetails.decimals)}, Need: ${amount}`
      );
    }

    // Detect token type and create appropriate payment
    const isEIP3009 = await isEIP3009Token(tokenContract, this.wallet.address);

    if (isEIP3009) {
      return await this._createEIP3009Payment({
        toAddress,
        tokenAddress,
        tokenDetails,
        value
      });
    } else {
      return await this._createERC20Payment({
        toAddress,
        tokenAddress,
        tokenContract,
        tokenDetails,
        value
      });
    }
  }

  /**
   * Settle a payment payload with the facilitator
   * @param {Object} payload - x402-compliant payment payload
   * @returns {Promise<Object>} - Settlement result
   */
  async settlePayment(payload) {
    const response = await fetch(`${this.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Settlement failed with status ${response.status}`);
    }

    return result;
  }

  /**
   * Verify a payment payload with the facilitator (without settling)
   * @param {Object} payload - x402-compliant payment payload
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPayment(payload) {
    const response = await fetch(`${this.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Verification failed with status ${response.status}`);
    }

    return result;
  }

  /**
   * Get supported networks and schemes from facilitator
   * @returns {Promise<Object>} - Supported configurations
   */
  async getSupported() {
    const response = await fetch(`${this.facilitatorUrl}/supported`);
    return await response.json();
  }

  /**
   * Create EIP-3009 payment (for USDC, EURC)
   * @private
   */
  async _createEIP3009Payment({ toAddress, tokenAddress, tokenDetails, value }) {
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60; // 60 seconds tolerance for clock skew
    const validBefore = now + 3600; // Valid for 1 hour
    const nonce = generateRandomNonce();

    // EIP-712 domain for the token contract
    const domain = {
      name: tokenDetails.name,
      version: tokenDetails.version,
      chainId: this.networkConfig.chainId,
      verifyingContract: tokenAddress
    };

    // EIP-3009 TransferWithAuthorization type
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
      from: this.wallet.address,
      to: toAddress,
      value: value,
      validAfter: validAfter,
      validBefore: validBefore,
      nonce: nonce
    };

    const signature = await this.wallet.signTypedData(domain, types, message);

    return this._formatX402Payload({
      signature,
      authorization: {
        from: message.from,
        to: message.to,
        value: message.value.toString(),
        validAfter: message.validAfter,
        validBefore: message.validBefore,
        nonce: message.nonce
      },
      tokenAddress,
      tokenDetails,
      isEIP3009: true
    });
  }

  /**
   * Create ERC-20 payment via Stargate (for USDT, DAI, etc.)
   * @private
   */
  async _createERC20Payment({ toAddress, tokenAddress, tokenContract, tokenDetails, value }) {
    // Fetch Stargate contract address
    const stargateAddress = await fetchStargateContract(this.network, this.facilitatorUrl);

    // Check allowance
    const allowance = await checkAllowance(tokenContract, this.wallet.address, stargateAddress);
    if (allowance < value) {
      throw new Error(
        `Insufficient Stargate approval. Current allowance: ${ethers.formatUnits(allowance, tokenDetails.decimals)}. ` +
        `Run 'npm run approve' in the SDK tools directory first.`
      );
    }

    // Get nonce from Stargate
    const nonce = await getStargateNonce(this.provider, stargateAddress, this.wallet.address, tokenAddress);

    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60;
    const validBefore = now + 3600;

    // EIP-712 domain for Stargate contract
    const domain = {
      name: 'Megalith',
      version: '1',
      chainId: this.networkConfig.chainId,
      verifyingContract: stargateAddress
    };

    // ERC20Payment type (matches MegalithStargate contract)
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
      from: this.wallet.address,
      to: toAddress,
      value: value,
      nonce: nonce,
      validAfter: validAfter,
      validBefore: validBefore
    };

    const signature = await this.wallet.signTypedData(domain, types, message);

    return this._formatX402Payload({
      signature,
      authorization: {
        from: message.from,
        to: message.to,
        value: message.value.toString(),
        validAfter: message.validAfter,
        validBefore: message.validBefore,
        nonce: nonce.toString()
      },
      tokenAddress,
      tokenDetails,
      stargateAddress,
      isEIP3009: false
    });
  }

  /**
   * Format authorization into x402-compliant payload
   * @private
   */
  _formatX402Payload({ signature, authorization, tokenAddress, tokenDetails, stargateAddress, isEIP3009 }) {
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: this.network,
      payload: {
        signature,
        authorization
      }
    };

    const extra = isEIP3009
      ? { name: tokenDetails.name, version: tokenDetails.version, gasLimit: '200000' }
      : { stargateContract: stargateAddress, gasLimit: '300000' };

    const paymentRequirements = {
      scheme: 'exact',
      network: this.network,
      maxAmountRequired: authorization.value,
      resource: '/api/settlement',
      description: `Payment of ${ethers.formatUnits(authorization.value, tokenDetails.decimals)} ${tokenDetails.symbol || 'tokens'}`,
      mimeType: 'application/json',
      outputSchema: { data: 'string' },
      payTo: authorization.to,
      maxTimeoutSeconds: 30,
      asset: tokenAddress,
      extra
    };

    return {
      x402Version: 1,
      paymentPayload,
      paymentRequirements
    };
  }
}

module.exports = { X402Client };
