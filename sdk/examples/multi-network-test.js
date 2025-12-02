#!/usr/bin/env node
// Multi-Network x402 Test Script
// Tests all 4 supported networks: base, base-sepolia, bsc, bsc-testnet
//
// Usage:
//   PRIVATE_KEY=0x... PAY_TO=0x... node multi-network-test.js
//
// The script will:
// 1. Start a local server with endpoints for each network
// 2. Test each network sequentially with prompts between tests
// 3. Report success/failure for each network

const express = require('express');
const readline = require('readline');
const { createSigner, x402Fetch, x402Express, NETWORKS } = require('../');

// ============================================
// Configuration
// ============================================

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PAY_TO = process.env.PAY_TO;
const SERVER_PORT = process.env.PORT || 3402;
const MAX_AMOUNT = process.env.MAX_AMOUNT || '0.01';

// Token addresses for USDC on each network
const TOKENS = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',           // USDC on Base
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',   // USDC on Base Sepolia
  'bsc': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',            // USDC on BNB Chain
  'bsc-testnet': '0x64544969ed7EBf5f083679233325356EbE738930'     // Test USDC on BNB Testnet
};

// Test amounts for each network (in human-readable format)
const TEST_AMOUNTS = {
  'base': '0.001',          // 0.001 USDC - mainnet, keep small
  'base-sepolia': '0.01',   // 0.01 USDC - testnet
  'bsc': '0.001',           // 0.001 USDC - mainnet, keep small
  'bsc-testnet': '0.01'     // 0.01 USDC - testnet
};

// Network display names
const NETWORK_NAMES = {
  'base': 'Base Mainnet',
  'base-sepolia': 'Base Sepolia (Testnet)',
  'bsc': 'BNB Chain Mainnet',
  'bsc-testnet': 'BNB Chain Testnet'
};

// ============================================
// Utilities
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function log(msg, ...args) {
  console.log(`[${new Date().toISOString().substr(11, 8)}] ${msg}`, ...args);
}

function success(msg) {
  console.log(`\x1b[32m✅ ${msg}\x1b[0m`);
}

function fail(msg) {
  console.log(`\x1b[31m❌ ${msg}\x1b[0m`);
}

function info(msg) {
  console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`);
}

function header(msg) {
  console.log(`\n\x1b[1m${'='.repeat(60)}\x1b[0m`);
  console.log(`\x1b[1m${msg}\x1b[0m`);
  console.log(`\x1b[1m${'='.repeat(60)}\x1b[0m\n`);
}

// ============================================
// Server Setup
// ============================================

function createServer(payTo) {
  const app = express();
  app.use(express.json());

  // Create routes for each network
  const routes = {};
  for (const network of Object.keys(TOKENS)) {
    routes[`/test/${network}`] = {
      amount: TEST_AMOUNTS[network],
      asset: TOKENS[network],
      network: network,
      description: `Test payment on ${NETWORK_NAMES[network]}`
    };
  }

  // Apply x402 middleware
  app.use(x402Express(payTo, routes));

  // Add success handlers for each route
  for (const network of Object.keys(TOKENS)) {
    app.get(`/test/${network}`, (req, res) => {
      res.json({
        success: true,
        network: network,
        message: `Payment received on ${NETWORK_NAMES[network]}!`,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', networks: Object.keys(TOKENS) });
  });

  // Info endpoint showing requirements for each network
  app.get('/info', (req, res) => {
    const info = {};
    for (const network of Object.keys(TOKENS)) {
      info[network] = {
        endpoint: `/test/${network}`,
        token: TOKENS[network],
        amount: TEST_AMOUNTS[network],
        display: NETWORK_NAMES[network]
      };
    }
    res.json(info);
  });

  return app;
}

// ============================================
// Test Runner
// ============================================

async function testNetwork(network, signer, serverUrl) {
  const endpoint = `${serverUrl}/test/${network}`;

  log(`Testing ${NETWORK_NAMES[network]}...`);
  log(`  Endpoint: ${endpoint}`);
  log(`  Token: ${TOKENS[network]}`);
  log(`  Amount: ${TEST_AMOUNTS[network]} USDC`);
  log(`  Payer: ${signer.getAddress()}`);

  try {
    const fetchWithPay = x402Fetch(fetch, signer, {
      maxAmount: MAX_AMOUNT,
      verify: true
    });

    const response = await fetchWithPay(endpoint);

    if (response.ok) {
      const data = await response.json();
      success(`${NETWORK_NAMES[network]}: Payment successful!`);
      log(`  Response: ${JSON.stringify(data)}`);

      // Check for payment response header
      const paymentResponse = response.headers.get('x-payment-response');
      if (paymentResponse) {
        try {
          const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString());
          log(`  Transaction: ${decoded.transactionHash || 'N/A'}`);
        } catch (e) {
          // Ignore decode errors
        }
      }
      return { success: true, network };
    } else {
      const errorData = await response.json().catch(() => ({}));
      fail(`${NETWORK_NAMES[network]}: HTTP ${response.status}`);
      log(`  Error: ${JSON.stringify(errorData)}`);
      return { success: false, network, error: errorData };
    }
  } catch (error) {
    fail(`${NETWORK_NAMES[network]}: ${error.message}`);
    return { success: false, network, error: error.message };
  }
}

// ============================================
// Main
// ============================================

async function main() {
  header('x402 Multi-Network Test Suite');

  // Validate environment
  if (!PRIVATE_KEY) {
    console.error('Missing PRIVATE_KEY environment variable');
    console.error('');
    console.error('Usage:');
    console.error('  PRIVATE_KEY=0x... PAY_TO=0x... node multi-network-test.js');
    console.error('');
    console.error('Environment variables:');
    console.error('  PRIVATE_KEY  - Your wallet private key (required)');
    console.error('  PAY_TO       - Address to receive payments (required)');
    console.error('  PORT         - Server port (default: 3402)');
    console.error('  MAX_AMOUNT   - Max payment per request (default: 0.01)');
    process.exit(1);
  }

  if (!PAY_TO) {
    console.error('Missing PAY_TO environment variable');
    console.error('Specify the address that should receive test payments.');
    process.exit(1);
  }

  info(`Payer wallet will be derived from PRIVATE_KEY`);
  info(`Payments will be sent to: ${PAY_TO}`);
  info(`Max amount per request: ${MAX_AMOUNT} tokens`);
  console.log('');

  // Start server
  const app = createServer(PAY_TO);
  const server = app.listen(SERVER_PORT, () => {
    log(`Server started on http://localhost:${SERVER_PORT}`);
    log(`Available test endpoints:`);
    for (const network of Object.keys(TOKENS)) {
      log(`  - /test/${network} (${NETWORK_NAMES[network]})`);
    }
  });

  const serverUrl = `http://localhost:${SERVER_PORT}`;
  const results = [];

  try {
    // Test each network
    const networks = Object.keys(TOKENS);

    for (let i = 0; i < networks.length; i++) {
      const network = networks[i];

      header(`Test ${i + 1}/${networks.length}: ${NETWORK_NAMES[network]}`);

      info(`Network: ${network}`);
      info(`Chain ID: ${NETWORKS[network].chainId}`);
      info(`Token: ${TOKENS[network]}`);
      info(`Amount: ${TEST_AMOUNTS[network]} USDC`);
      console.log('');

      // Ask user if they want to test this network
      const answer = await prompt(`Test ${NETWORK_NAMES[network]}? (y/n/q to quit): `);

      if (answer.toLowerCase() === 'q') {
        log('User quit test suite');
        break;
      }

      if (answer.toLowerCase() !== 'y') {
        log(`Skipping ${NETWORK_NAMES[network]}`);
        results.push({ network, skipped: true });
        continue;
      }

      // Create signer for this network
      log(`Creating signer for ${network}...`);
      let signer;
      try {
        signer = await createSigner(network, PRIVATE_KEY);
        log(`Signer created: ${signer.getAddress()}`);
      } catch (error) {
        fail(`Failed to create signer: ${error.message}`);
        results.push({ network, success: false, error: error.message });
        continue;
      }

      // Run the test
      const result = await testNetwork(network, signer, serverUrl);
      results.push(result);

      // Wait between tests on mainnet
      if (network === 'base' || network === 'bsc') {
        console.log('');
        info('Waiting 2 seconds before next test (rate limiting)...');
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Summary
    header('Test Results Summary');

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const result of results) {
      if (result.skipped) {
        console.log(`⏭️  ${NETWORK_NAMES[result.network]}: SKIPPED`);
        skipped++;
      } else if (result.success) {
        console.log(`\x1b[32m✅ ${NETWORK_NAMES[result.network]}: PASSED\x1b[0m`);
        passed++;
      } else {
        console.log(`\x1b[31m❌ ${NETWORK_NAMES[result.network]}: FAILED - ${result.error}\x1b[0m`);
        failed++;
      }
    }

    console.log('');
    console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  } finally {
    // Cleanup
    server.close();
    rl.close();
    log('Server stopped');
  }
}

main().catch(console.error);
