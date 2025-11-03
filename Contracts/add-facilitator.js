// Script to call addFacilitator on MegalithStargate contract
// Usage: NETWORK=base-mainnet FACILITATOR=0x... OWNER_KEY=0x... node add-facilitator.js

require('dotenv').config();
const { ethers } = require('ethers');

// Configuration from environment
const NETWORK = process.env.NETWORK || 'base';
const STARGATE_ADDRESS = process.env.STARGATE_ADDRESS || '0x40200001004B5110333e4De8179426971Efd034A';
const FACILITATOR_ADDRESS = process.env.FACILITATOR_ADDRESS;
const OWNER_PRIVATE_KEY = process.env.OWNER_KEY;

// Network configurations
const NETWORKS = {
  'base': {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: process.env.RPC_BASE || 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org'
  },
  'bsc': {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    rpcUrl: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com'
  },
  'bsc-testnet': {
    name: 'BNB Chain Testnet',
    chainId: 97,
    rpcUrl: process.env.RPC_BSC_TESTNET || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorer: 'https://testnet.bscscan.com'
  }
};

// Minimal ABI - just the functions we need
const STARGATE_ABI = [
  'function addFacilitator(address facilitator) external',
  'function isFacilitator(address facilitator) external view returns (bool)',
  'function owner() external view returns (address)',
  'function facilitators(address) external view returns (bool)'
];

async function main() {
  console.log('=== MegalithStargate - Add Facilitator ===\n');

  // Validate inputs
  if (!FACILITATOR_ADDRESS) {
    console.error('❌ FACILITATOR_ADDRESS environment variable is required');
    console.error('Example: FACILITATOR_ADDRESS=0x... node add-facilitator.js');
    process.exit(1);
  }

  if (!OWNER_PRIVATE_KEY) {
    console.error('❌ OWNER_KEY environment variable is required');
    console.error('Example: OWNER_KEY=0x... node add-facilitator.js');
    process.exit(1);
  }

  if (!NETWORKS[NETWORK]) {
    console.error('❌ Invalid NETWORK:', NETWORK);
    console.error('Valid options:', Object.keys(NETWORKS).join(', '));
    process.exit(1);
  }

  const networkConfig = NETWORKS[NETWORK];

  // Validate addresses
  if (!ethers.isAddress(FACILITATOR_ADDRESS)) {
    console.error('❌ Invalid FACILITATOR_ADDRESS:', FACILITATOR_ADDRESS);
    process.exit(1);
  }

  if (!ethers.isAddress(STARGATE_ADDRESS)) {
    console.error('❌ Invalid STARGATE_ADDRESS:', STARGATE_ADDRESS);
    process.exit(1);
  }

  console.log('Network:', networkConfig.name);
  console.log('Chain ID:', networkConfig.chainId);
  console.log('RPC:', networkConfig.rpcUrl);
  console.log('Stargate Contract:', STARGATE_ADDRESS);
  console.log('Facilitator Address:', FACILITATOR_ADDRESS);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

  console.log('\nOwner Address:', wallet.address);

  // Connect to contract
  const stargate = new ethers.Contract(STARGATE_ADDRESS, STARGATE_ABI, wallet);

  // Check current state
  console.log('\n=== Checking Current State ===');

  try {
    const contractOwner = await stargate.owner();
    console.log('Contract Owner:', contractOwner);

    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error('❌ ERROR: You are not the contract owner!');
      console.error(`   Your address: ${wallet.address}`);
      console.error(`   Owner address: ${contractOwner}`);
      process.exit(1);
    }
    console.log('✓ Owner verification passed');
  } catch (error) {
    console.error('❌ Could not verify ownership:', error.message);
    process.exit(1);
  }

  try {
    const isFacilitator = await stargate.facilitators(FACILITATOR_ADDRESS);
    console.log('Is Facilitator (before):', isFacilitator);

    if (isFacilitator) {
      console.log('\n⚠️  WARNING: This address is already a facilitator!');
      console.log('No transaction needed.');
      process.exit(0);
    }
  } catch (error) {
    console.error('⚠️  Could not check facilitator status:', error.message);
  }

  // Add facilitator
  console.log('\n=== Adding Facilitator ===');
  console.log('Calling addFacilitator(' + FACILITATOR_ADDRESS + ')...');

  try {
    const tx = await stargate.addFacilitator(FACILITATOR_ADDRESS);
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log('\n✅ SUCCESS!');
      console.log('Block Number:', receipt.blockNumber);
      console.log('Gas Used:', receipt.gasUsed.toString());
      console.log('Transaction Hash:', receipt.hash);
      console.log('Explorer:', `${networkConfig.explorer}/tx/${receipt.hash}`);

      // Verify the change
      const isFacilitatorNow = await stargate.facilitators(FACILITATOR_ADDRESS);
      console.log('\nIs Facilitator (after):', isFacilitatorNow);

      if (isFacilitatorNow) {
        console.log('\n🎉 Facilitator successfully added!');
      } else {
        console.log('\n⚠️  Warning: Transaction succeeded but facilitator status not confirmed');
      }
    } else {
      console.error('\n❌ Transaction failed');
      console.error('Receipt:', receipt);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('You need more ETH for gas fees');
    } else if (error.code === 'CALL_EXCEPTION') {
      console.error('Contract call failed - check if you are the owner');
    }

    if (error.data) {
      console.error('Error data:', error.data);
    }

    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
