// Megalith x402 Signer & Payload Creator
// Supports both EIP-3009 and standard ERC-20 tokens
// Supports BNB Chain Mainnet (56) and Testnet (97)
// https://megalithlabs.ai

console.log("=== Megalith x402 Signer & Payload Creator ===\n");

require('dotenv').config({ path: 'signer.env' });
const { ethers } = require('ethers');

// Custom JSON replacer to handle BigInt serialization
const replacer = (key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

(async () => {
  // ============================================
  // LOAD CONFIGURATION
  // ============================================
  
  const NETWORK = parseInt(process.env.NETWORK) || 56;
  const PAYER_KEY = process.env.PAYER_KEY;
  const RECIPIENT = process.env.RECIPIENT;
  const TOKEN = process.env.TOKEN;
  const AMOUNT = process.env.AMOUNT;
  
  // Network-specific configuration
  const NETWORK_CONFIG = {
    56: {
      name: 'BNB Chain Mainnet',
      rpcUrl: 'https://bsc-dataseed.binance.org/',
      stargateContract: process.env.STARGATE_CONTRACT_MAINNET
    },
    97: {
      name: 'BNB Chain Testnet',
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      stargateContract: process.env.STARGATE_CONTRACT_TESTNET
    }
  };

  // Validate network
  if (!NETWORK_CONFIG[NETWORK]) {
    console.error("❌ Invalid NETWORK in .env file");
    console.error("Supported networks: 56 (BNB Mainnet), 97 (BNB Testnet)");
    process.exit(1);
  }

  const networkConfig = NETWORK_CONFIG[NETWORK];
  const STARGATE_CONTRACT = networkConfig.stargateContract;

  if (!PAYER_KEY || !RECIPIENT || !TOKEN || !AMOUNT) {
    console.error("❌ Missing configuration in .env file");
    console.error("Required: NETWORK, PAYER_KEY, RECIPIENT, TOKEN, AMOUNT");
    process.exit(1);
  }

  console.log("=== Megalith x402 Payment Authorization Creator ===\n");
  console.log("Network:", networkConfig.name, `(Chain ID: ${NETWORK})`);
  console.log("RPC:", networkConfig.rpcUrl);
  console.log("Token:", TOKEN);
  console.log("Recipient:", RECIPIENT);
  console.log("Amount:", AMOUNT);

  // ============================================
  // CONNECT TO NETWORK
  // ============================================
  
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(PAYER_KEY, provider);

  console.log("Payer address:", wallet.address);

  // Extended token ABI with EIP-3009 detection
  const tokenABI = [
    'function name() view returns (string)',
    'function version() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function authorizationState(address, bytes32) view returns (bool)', // EIP-3009 only
    'function allowance(address owner, address spender) view returns (uint256)' // Check approval for ERC-20
  ];
  
  const token = new ethers.Contract(TOKEN, tokenABI, provider);
  
  // ============================================
  // FETCH TOKEN DETAILS
  // ============================================
  
  let tokenName, tokenVersion, tokenSymbol, balance;
  try {
    tokenName = await token.name();
    console.log("Token name:", tokenName);
  } catch (e) {
    console.error("❌ Failed to fetch token name:", e.message);
    process.exit(1);
  }

  try {
    tokenVersion = await token.version();
    console.log("Token version:", tokenVersion);
  } catch (e) {
    console.log("⚠️  Token version() not available, defaulting to '1'");
    tokenVersion = '1';
  }

  try {
    tokenSymbol = await token.symbol();
    console.log("Token symbol:", tokenSymbol);
  } catch (e) {
    console.log("⚠️  Could not fetch token symbol");
  }

  try {
    balance = await token.balanceOf(wallet.address);
    console.log("Payer balance:", ethers.formatUnits(balance, 18), tokenSymbol || "tokens");
  } catch (e) {
    console.log("⚠️  Could not fetch balance");
  }

  // ============================================
  // DETECT TOKEN TYPE (EIP-3009 vs Standard ERC-20)
  // ============================================
  
  console.log("\n🔍 Detecting token type...");
  
  let isEIP3009 = false;
  try {
    // Try to call authorizationState - only exists on EIP-3009 tokens
    const testNonce = ethers.randomBytes(32);
    await token.authorizationState(wallet.address, testNonce);
    isEIP3009 = true;
    console.log("✅ EIP-3009 token detected (supports transferWithAuthorization)");
  } catch (e) {
    isEIP3009 = false;
    console.log("✅ Standard ERC-20 token detected (will use MegalithStargate)");
  }

  // ============================================
  // CREATE AUTHORIZATION BASED ON TOKEN TYPE
  // ============================================

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 60;  // 60 seconds in the past to account for clock skew
  const validBefore = now + 3600;  // Valid for 1 hour
  const value = ethers.parseUnits(AMOUNT, 18);

  console.log("\n=== Authorization Details ===");
  console.log("Valid after:", new Date(validAfter * 1000).toISOString());
  console.log("Valid before:", new Date(validBefore * 1000).toISOString());
  console.log("Value:", ethers.formatUnits(value, 18), tokenSymbol || "tokens");

  let payload, sig, message, domain, types, nonce;

  if (isEIP3009) {
    // ============================================
    // PATH A: EIP-3009 TOKEN
    // ============================================
    
    console.log("\n=== Creating EIP-3009 Authorization ===");
    
    // Generate random bytes32 nonce for EIP-3009
    nonce = ethers.hexlify(ethers.randomBytes(32));
    console.log("Nonce (bytes32):", nonce);

    // EIP-712 domain for the token contract
    domain = { 
      name: tokenName,
      version: tokenVersion,
      chainId: NETWORK,
      verifyingContract: TOKEN 
    };

    // EIP-3009 TransferWithAuthorization type definition
    types = { 
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    message = {
      from: wallet.address,
      to: RECIPIENT,
      value: value,
      validAfter: validAfter,
      validBefore: validBefore,
      nonce: nonce
    };

    sig = await wallet.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);

    console.log("✅ Signature created successfully");

    payload = {
      paymentPayload: {
        payload: {
          authorization: {
            from: message.from,
            to: message.to,
            value: message.value.toString(),
            validAfter: message.validAfter,
            validBefore: message.validBefore,
            nonce: message.nonce,
            v: Number(v),
            r: r.toString(),
            s: s.toString()
          }
        }
      },
      paymentRequirements: {
        network: NETWORK,
        asset: TOKEN,
        recipient: RECIPIENT,
        amount: message.value.toString()
      }
    };

  } else {
    // ============================================
    // PATH B: STANDARD ERC-20 TOKEN
    // ============================================
    
    console.log("\n=== Creating ERC-20 Authorization (MegalithStargate) ===");

    // Check if STARGATE_CONTRACT is set
    if (!STARGATE_CONTRACT || STARGATE_CONTRACT === '0x0000000000000000000000000000000000000000') {
      console.error("\n❌ ERROR: STARGATE_CONTRACT not configured for this network");
      console.error(`Network: ${networkConfig.name} (Chain ID: ${NETWORK})`);
      console.error("\nFor standard ERC-20 tokens, you must:");
      console.error("  1. Deploy MegalithStargate contract on this network");
      console.error(`  2. Set STARGATE_CONTRACT_${NETWORK === 56 ? 'MAINNET' : 'TESTNET'} in .env`);
      console.error("\nExample:");
      console.error(`  STARGATE_CONTRACT_${NETWORK === 56 ? 'MAINNET' : 'TESTNET'}=0x40200001004b5110333e4de8179426971efd034a`);
      process.exit(1);
    }

    console.log("Stargate contract:", STARGATE_CONTRACT);

    // Check if user has approved the facilitator contract
    try {
      const allowance = await token.allowance(wallet.address, STARGATE_CONTRACT);
      if (allowance < value) {
        console.log("\n⚠️  WARNING: Insufficient approval!");
        console.log("Current allowance:", ethers.formatUnits(allowance, 18), tokenSymbol);
        console.log("Required amount:", ethers.formatUnits(value, 18), tokenSymbol);
        console.log("\n👉 You must first run: node approve-token.js");
        console.log("This will approve the MegalithStargate contract to spend your tokens.");
        console.log("\nContinuing anyway - settlement will fail if approval is not done...\n");
      } else {
        console.log("✅ Stargate contract has sufficient approval");
      }
    } catch (e) {
      console.log("⚠️  Could not check approval status");
    }

    // Get current nonce from facilitator contract
    const facilitatorABI = [
      'function getNonce(address user, address token) view returns (uint256)'
    ];
    const facilitatorContract = new ethers.Contract(STARGATE_CONTRACT, facilitatorABI, provider);
    
    let currentNonce;
    try {
      currentNonce = await facilitatorContract.getNonce(wallet.address, TOKEN);
      console.log("Current nonce (uint256):", currentNonce.toString());
    } catch (e) {
      console.error("❌ Failed to fetch nonce from Stargate contract");
      console.error("Is STARGATE_CONTRACT address correct?");
      console.error("Error:", e.message);
      process.exit(1);
    }

    nonce = currentNonce;

    // EIP-712 domain for MegalithStargate contract
    domain = {
      name: "Megalith",
      version: "1",
      chainId: NETWORK,
      verifyingContract: STARGATE_CONTRACT
    };

    // ERC20Payment type definition (matches MegalithStargate contract)
    types = {
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

    message = {
      token: TOKEN,
      from: wallet.address,
      to: RECIPIENT,
      value: value,
      nonce: nonce,
      validAfter: validAfter,
      validBefore: validBefore
    };

    sig = await wallet.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);

    console.log("✅ Signature created successfully");

    payload = {
      paymentPayload: {
        payload: {
          authorization: {
            from: message.from,
            to: message.to,
            value: message.value.toString(),
            validAfter: message.validAfter,
            validBefore: message.validBefore,
            nonce: nonce.toString(), // uint256 as string
            v: Number(v),
            r: r.toString(),
            s: s.toString()
          }
        }
      },
      paymentRequirements: {
        network: NETWORK,
        asset: TOKEN,
        recipient: RECIPIENT,
        amount: message.value.toString()
      }
    };
  }

  // ============================================
  // SAVE PAYLOAD
  // ============================================

  console.log("\n=== PAYMENT PAYLOAD ===");
  console.log(JSON.stringify(payload, replacer, 2));
  console.log("=======================\n");

  const fs = require('fs');
  
  // Create payloads directory if it doesn't exist
  if (!fs.existsSync('payloads')) {
    fs.mkdirSync('payloads');
  }
  
  // Save main payload file (always overwrites)
  const mainFile = 'payload.json';
  fs.writeFileSync(mainFile, JSON.stringify(payload, replacer, 2));
  console.log(`✅ Saved to: ${mainFile}`);
  
  // Save timestamped backup in payloads folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds for cleaner name
  const archiveFile = `payloads/payload-${timestamp}.json`;
  fs.writeFileSync(archiveFile, JSON.stringify(payload, replacer, 2));
  console.log(`✅ Archived to: ${archiveFile}`);

  // ============================================
  // USAGE INSTRUCTIONS
  // ============================================

  console.log("\n=== USAGE ===");
  console.log(`Network: ${networkConfig.name} (Chain ID: ${NETWORK})`);
  
  if (isEIP3009) {
    console.log("\n📋 EIP-3009 TOKEN - Use /settle endpoint:");
    console.log(`  curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json`);
  } else {
    console.log("\n📋 STANDARD ERC-20 TOKEN - Use /settle endpoint:");
    console.log("  (The facilitator auto-detects token type)");
    console.log(`  curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json`);
    console.log("\n⚠️  IMPORTANT: Make sure you've run approve-token.js first!");
  }

  console.log("\n💻 Local testing:");
  console.log(`  curl.exe -X POST http://localhost:3000/settle --% -H "Content-Type: application/json" -d @payload.json`);
  
  console.log("\n=============\n");

  console.log("✅ Payment authorization created successfully!");
  console.log("Network:", networkConfig.name, `(Chain ID: ${NETWORK})`);
  console.log("Type:", isEIP3009 ? "EIP-3009 (direct)" : "ERC-20 (via MegalithStargate)");
  console.log("From:", wallet.address);
  console.log("To:", RECIPIENT);
  console.log("Amount:", ethers.formatUnits(value, 18), tokenSymbol || "tokens");
  console.log("The facilitator will pay the gas fees.");

})().catch(error => {
  console.error("\n❌ Error:", error.message);
  if (error.stack) {
    console.error("\nStack trace:");
    console.error(error.stack);
  }
  process.exit(1);
});
