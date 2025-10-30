// Megalith x402 Token Approval Tool
// Approves ERC-20 tokens for use with MegalithStargate contract
// Supports BNB Chain Mainnet (56) and Testnet (97)
// https://megalithlabs.ai

const { ethers } = require('ethers');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config({ path: './approve.env' });

// ============================================
// CONFIGURATION
// ============================================

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ERC-20 ABI (just what we need for approval)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address account) view returns (uint256)',
];

// RPC endpoints
const RPC_URLS = {
  '56': 'https://bsc-dataseed.binance.org',
  '97': 'https://data-seed-prebsc-1-s1.binance.org:8545',
};

// Facilitator API
const FACILITATOR_API = process.env.FACILITATOR_API || 'https://x402.megalithlabs.ai';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper to prompt user for confirmation
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Fetch latest Stargate contract from API
async function fetchStargateContract(network) {
  try {
    console.log(`${colors.cyan}→${colors.reset} Fetching latest Stargate contract from API...`);
    const response = await fetch(`${FACILITATOR_API}/contracts`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const contracts = await response.json();
    
    if (!contracts[network]) {
      throw new Error(`Network ${network} not supported`);
    }
    
    const { stargate, version } = contracts[network];
    console.log(`${colors.green}✓${colors.reset} Stargate: ${stargate} (v${version})`);
    return stargate;
  } catch (error) {
    console.log(`${colors.yellow}⚠${colors.reset} Could not fetch from API: ${error.message}`);
    return null;
  }
}

// Format token amount with decimals
function formatAmount(amount, decimals) {
  return ethers.formatUnits(amount, decimals);
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log(`\n${colors.bright}=== x402 Token Approval ===${colors.reset}\n`);

  // ============================================
  // LOAD CONFIGURATION
  // ============================================
  
  const network = process.env.NETWORK;
  const approverKey = process.env.APPROVER_KEY;
  const tokenAddress = process.env.TOKEN;
  let stargateAddress = process.env.STARGATE_CONTRACT;
  const amountConfig = process.env.AMOUNT || 'unlimited';

  // ============================================
  // VALIDATE CONFIGURATION
  // ============================================
  
  if (!network || !RPC_URLS[network]) {
    console.error(`${colors.red}✗${colors.reset} Invalid NETWORK in approve.env (use 56 or 97)`);
    process.exit(1);
  }

  if (!approverKey || !approverKey.startsWith('0x')) {
    console.error(`${colors.red}✗${colors.reset} Invalid APPROVER_KEY in approve.env`);
    process.exit(1);
  }

  if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    console.error(`${colors.red}✗${colors.reset} Invalid TOKEN address in approve.env`);
    process.exit(1);
  }

  // ============================================
  // CONNECT TO NETWORK
  // ============================================
  
  const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
  const wallet = new ethers.Wallet(approverKey, provider);
  const approver = wallet.address;

  console.log(`${colors.blue}Network:${colors.reset} ${network === '56' ? 'BNB Chain Mainnet' : 'BNB Chain Testnet'} (${network})`);
  console.log(`${colors.blue}Token:${colors.reset} ${tokenAddress}`);
  console.log(`${colors.blue}Approver:${colors.reset} ${approver}\n`);

  // ============================================
  // GET STARGATE CONTRACT ADDRESS
  // ============================================
  
  if (!stargateAddress || stargateAddress === '') {
    stargateAddress = await fetchStargateContract(network);
    
    if (!stargateAddress) {
      console.error(`${colors.red}✗${colors.reset} Could not get Stargate contract address`);
      console.error(`${colors.yellow}→${colors.reset} Please set STARGATE_CONTRACT in approve.env manually`);
      process.exit(1);
    }
  } else {
    console.log(`${colors.cyan}→${colors.reset} Using Stargate from approve.env: ${stargateAddress}`);
    
    // Verify with API if possible
    const apiStargate = await fetchStargateContract(network);
    if (apiStargate && apiStargate.toLowerCase() !== stargateAddress.toLowerCase()) {
      console.log(`${colors.yellow}⚠${colors.reset} Warning: Your configured Stargate (${stargateAddress}) differs from API (${apiStargate})`);
      const proceed = await askConfirmation(`${colors.yellow}Continue with your configured address? (y/n):${colors.reset} `);
      if (!proceed) {
        console.log(`${colors.red}✗${colors.reset} Aborted`);
        process.exit(0);
      }
    }
  }

  try {
    stargateAddress = ethers.getAddress(stargateAddress); // Normalize to checksum format
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Invalid Stargate contract address: ${stargateAddress}`);
    process.exit(1);
  }

  // ============================================
  // CONNECT TO TOKEN CONTRACT
  // ============================================
  
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

  try {
    // ============================================
    // FETCH TOKEN DETAILS
    // ============================================
    
    const [symbol, decimals, balance, currentAllowance] = await Promise.all([
      token.symbol(),
      token.decimals(),
      token.balanceOf(approver),
      token.allowance(approver, stargateAddress),
    ]);

    console.log(`${colors.blue}Token Symbol:${colors.reset} ${symbol}`);
    console.log(`${colors.blue}Token Decimals:${colors.reset} ${decimals}`);
    console.log(`${colors.blue}Your Balance:${colors.reset} ${formatAmount(balance, decimals)} ${symbol}\n`);

    console.log(`${colors.cyan}Current allowance:${colors.reset} ${formatAmount(currentAllowance, decimals)} ${symbol}`);
    console.log(`${colors.cyan}Spender (Stargate):${colors.reset} ${stargateAddress}\n`);

    // ============================================
    // DETERMINE APPROVAL AMOUNT
    // ============================================
    
    let approvalAmount;
    if (amountConfig.toLowerCase() === 'unlimited') {
      approvalAmount = ethers.MaxUint256;
      console.log(`${colors.yellow}Approving:${colors.reset} ${colors.bright}UNLIMITED${colors.reset} ${symbol}`);
    } else {
      approvalAmount = ethers.parseUnits(amountConfig, decimals);
      console.log(`${colors.yellow}Approving:${colors.reset} ${formatAmount(approvalAmount, decimals)} ${symbol}`);
    }

    // ============================================
    // WARNING FOR UNLIMITED APPROVAL
    // ============================================
    
    if (approvalAmount === ethers.MaxUint256) {
      console.log(`\n${colors.red}${colors.bright}⚠  WARNING ⚠${colors.reset}`);
      console.log(`${colors.yellow}You are approving UNLIMITED token spend!${colors.reset}`);
      console.log(`${colors.yellow}The Stargate contract will be able to transfer any amount of ${symbol} from your wallet.${colors.reset}`);
      console.log(`${colors.yellow}Only proceed if you trust the contract: ${stargateAddress}${colors.reset}\n`);
    }

    // ============================================
    // CONFIRMATION
    // ============================================
    
    const proceed = await askConfirmation(`${colors.cyan}Continue with approval? (y/n):${colors.reset} `);
    
    if (!proceed) {
      console.log(`\n${colors.red}✗${colors.reset} Approval cancelled`);
      process.exit(0);
    }

    // ============================================
    // SEND APPROVAL TRANSACTION
    // ============================================
    
    console.log(`\n${colors.cyan}→${colors.reset} Sending approval transaction...`);
    const tx = await token.approve(stargateAddress, approvalAmount);
    console.log(`${colors.cyan}→${colors.reset} Transaction sent: ${tx.hash}`);
    console.log(`${colors.cyan}→${colors.reset} Waiting for confirmation...`);

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`\n${colors.green}${colors.bright}✓ Approval successful!${colors.reset}`);
      console.log(`${colors.green}Transaction hash:${colors.reset} ${receipt.hash}`);
      console.log(`${colors.green}Block number:${colors.reset} ${receipt.blockNumber}`);
      console.log(`${colors.green}Gas used:${colors.reset} ${receipt.gasUsed.toString()}\n`);
      
      // Verify new allowance
      const newAllowance = await token.allowance(approver, stargateAddress);
      console.log(`${colors.green}New allowance:${colors.reset} ${newAllowance === ethers.MaxUint256 ? 'UNLIMITED' : formatAmount(newAllowance, decimals)} ${symbol}\n`);
      
      console.log(`${colors.bright}You can now create payments with this token using signer.js${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}✗ Transaction failed${colors.reset}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n${colors.red}✗ Error:${colors.reset} ${error.message}`);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error(`${colors.yellow}→${colors.reset} You don't have enough BNB for gas fees`);
    } else if (error.code === 'NONCE_EXPIRED') {
      console.error(`${colors.yellow}→${colors.reset} Transaction nonce issue - try again`);
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${colors.red}✗ Unexpected error:${colors.reset}`, error);
  process.exit(1);
});