// Basic x402 Payment Example
// Run: node examples/basic-payment.js

require('dotenv').config();
const { X402Client } = require('../');

// Configuration from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || 'base-sepolia';
const RECIPIENT = process.env.RECIPIENT;
const TOKEN = process.env.TOKEN;
const AMOUNT = process.env.AMOUNT || '1.00';

async function main() {
  // Validate configuration
  if (!PRIVATE_KEY || !RECIPIENT || !TOKEN) {
    console.error('Missing configuration. Set environment variables:');
    console.error('  PRIVATE_KEY - Your wallet private key');
    console.error('  RECIPIENT   - Payment recipient address');
    console.error('  TOKEN       - Token contract address');
    console.error('  NETWORK     - Network (default: base-sepolia)');
    console.error('  AMOUNT      - Amount to send (default: 1.00)');
    process.exit(1);
  }

  // Initialize client
  const client = new X402Client({
    privateKey: PRIVATE_KEY,
    network: NETWORK
  });

  console.log('=== x402 Payment Example ===\n');
  console.log('Network:', client.getNetworkInfo().name);
  console.log('From:', client.getAddress());
  console.log('To:', RECIPIENT);
  console.log('Token:', TOKEN);
  console.log('Amount:', AMOUNT);
  console.log('');

  try {
    // Option 1: Create and settle in one call
    console.log('Creating and settling payment...\n');
    const result = await client.pay({
      to: RECIPIENT,
      amount: AMOUNT,
      token: TOKEN
    });

    console.log('Payment successful!');
    console.log('Transaction hash:', result.txHash);
    console.log('Block number:', result.blockNumber);

  } catch (error) {
    console.error('Payment failed:', error.message);

    // Helpful error messages
    if (error.message.includes('Insufficient balance')) {
      console.error('\nYou need more tokens in your wallet.');
    } else if (error.message.includes('Insufficient Stargate approval')) {
      console.error('\nFor ERC-20 tokens, run: npm run approve');
    }

    process.exit(1);
  }
}

main();
