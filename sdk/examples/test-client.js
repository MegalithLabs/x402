#!/usr/bin/env node
// Simple x402 Client Test
// Tests payment against an existing x402-enabled endpoint
//
// Usage:
//   PRIVATE_KEY=0x... NETWORK=base API_URL=https://your-api.com/endpoint node test-client.js
//
// Environment variables:
//   PRIVATE_KEY  - Your wallet private key (required)
//   NETWORK      - Network to use: base, base-sepolia, bsc, bsc-testnet (required)
//   API_URL      - The x402-enabled endpoint to test (required)
//   MAX_AMOUNT   - Maximum tokens to pay (default: 0.10)
//   DEBUG        - Set to "x402:*" for verbose logging

const { createSigner, x402Fetch, NETWORKS } = require('../');

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK;
const API_URL = process.env.API_URL;
const MAX_AMOUNT = process.env.MAX_AMOUNT || '0.10';

// Network display names
const NETWORK_NAMES = {
  'base': 'Base Mainnet',
  'base-sepolia': 'Base Sepolia (Testnet)',
  'bsc': 'BNB Chain Mainnet',
  'bsc-testnet': 'BNB Chain Testnet'
};

async function main() {
  console.log('='.repeat(60));
  console.log('x402 Client Test');
  console.log('='.repeat(60));
  console.log('');

  // Validate inputs
  if (!PRIVATE_KEY) {
    console.error('Missing PRIVATE_KEY environment variable');
    console.error('');
    console.error('Usage:');
    console.error('  PRIVATE_KEY=0x... NETWORK=base API_URL=https://api.example.com/paid node test-client.js');
    console.error('');
    console.error('Supported networks:', Object.keys(NETWORKS).join(', '));
    process.exit(1);
  }

  if (!NETWORK) {
    console.error('Missing NETWORK environment variable');
    console.error('Supported networks:', Object.keys(NETWORKS).join(', '));
    process.exit(1);
  }

  if (!NETWORKS[NETWORK]) {
    console.error(`Invalid network: ${NETWORK}`);
    console.error('Supported networks:', Object.keys(NETWORKS).join(', '));
    process.exit(1);
  }

  if (!API_URL) {
    console.error('Missing API_URL environment variable');
    console.error('Specify the x402-enabled endpoint to test.');
    process.exit(1);
  }

  console.log(`Network:    ${NETWORK_NAMES[NETWORK]} (${NETWORK})`);
  console.log(`Chain ID:   ${NETWORKS[NETWORK].chainId}`);
  console.log(`API URL:    ${API_URL}`);
  console.log(`Max Amount: ${MAX_AMOUNT} tokens`);
  console.log('');

  // Create signer
  console.log('Creating signer...');
  let signer;
  try {
    signer = await createSigner(NETWORK, PRIVATE_KEY);
    console.log(`Signer address: ${signer.getAddress()}`);
  } catch (error) {
    console.error(`Failed to create signer: ${error.message}`);
    process.exit(1);
  }
  console.log('');

  // Create x402-enabled fetch
  const fetchWithPay = x402Fetch(fetch, signer, {
    maxAmount: MAX_AMOUNT,
    verify: true
  });

  // Make the request
  console.log('Making request...');
  console.log('');

  try {
    const startTime = Date.now();
    const response = await fetchWithPay(API_URL);
    const elapsed = Date.now() - startTime;

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Time: ${elapsed}ms`);
    console.log('');

    // Check for payment response header
    const paymentResponse = response.headers.get('x-payment-response');
    if (paymentResponse) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString());
        console.log('Payment Response:');
        console.log(`  Transaction: ${decoded.transactionHash || 'N/A'}`);
        console.log(`  Success: ${decoded.success}`);
        if (decoded.settledAt) console.log(`  Settled At: ${decoded.settledAt}`);
      } catch (e) {
        console.log('Payment Response: (could not decode)');
      }
      console.log('');
    }

    // Show response body
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Response Body:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Response Body:');
      console.log(text.slice(0, 500));
      if (text.length > 500) console.log('... (truncated)');
    }

    console.log('');
    if (response.ok) {
      console.log('\x1b[32m✅ SUCCESS!\x1b[0m');
    } else {
      console.log('\x1b[33m⚠️  Request completed but returned non-2xx status\x1b[0m');
    }

  } catch (error) {
    console.error(`\x1b[31m❌ FAILED: ${error.message}\x1b[0m`);
    if (error.code) console.error(`   Error code: ${error.code}`);
    if (error.details) console.error(`   Details: ${JSON.stringify(error.details)}`);
    process.exit(1);
  }
}

main().catch(console.error);
