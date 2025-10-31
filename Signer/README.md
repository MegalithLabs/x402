# Megalith x402 Payment Signer

Create x402-compliant payment authorizations for both EIP-3009 and standard ERC-20 tokens on supported networks.

**Part of the x402 protocol**: An open standard for internet-native payments using HTTP 402 status codes.

Learn more: [x402.org](https://x402.org) | [Megalith Labs](https://megalithlabs.ai)

---

## What is x402?

x402 is an open payment protocol that enables AI agents and web services to autonomously pay for API access, data, and digital services using stablecoins like USDC. It leverages the HTTP 402 "Payment Required" status code to enable:

- 🤖 **AI-native payments** - Agents pay for APIs autonomously
- 💰 **Micropayments** - Transactions as low as $0.001
- ⚡ **Instant settlement** - ~200ms on Layer 2
- 🔓 **No accounts required** - Pay-per-use without registration
- 🌐 **Chain agnostic** - Works on any blockchain

This signer creates x402-compliant payment authorizations that can be used with any x402-compatible API or facilitator service.

---

## Important: Terminal Differences

**Different terminals handle curl differently:**

### Windows PowerShell (Most Windows Users)
Use `curl.exe` with the `--%` flag:
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

### Windows CMD / Git Bash / Linux / macOS
Use standard `curl`:
```bash
curl -X POST https://x402.megalithlabs.ai/settle -H "Content-Type: application/json" -d @payload.json
```

**All examples below show both formats.**

---

## Features

- ✅ **x402 Protocol Compliant**: Outputs standard x402 v1 payment payloads
- ✅ **EIP-3009 Support**: Direct authorization for USDC and other EIP-3009 tokens
- ✅ **Standard ERC-20 Support**: Works with any ERC-20 token via MegalithStargate
- ✅ **Multi-Network**: V1 supports BNB Chain Mainnet (56) and Testnet (97)
- ✅ **Automatic Token Detection**: Auto-detects token type and signs appropriately
- ✅ **Smart Scheme Hints**: Uses "exact" scheme (Megalith facilitator auto-detects if needed)
- ✅ **Dual Output Format**: Creates both facilitator POST and X-PAYMENT header formats
- ✅ **API Contract Fetching**: Automatically uses latest Stargate contract version
- ✅ **Token Approval Tool**: Easy approval for standard ERC-20 tokens
- ✅ **Secure Signing**: All signing happens locally with your private key

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example config and add your details:

```bash
cp signer.env.example signer.env
nano signer.env
```

**Required fields:**
```bash
NETWORK=56              # 56=BNB Mainnet, 97=BNB testnet
PAYER_KEY=0x...         # Your private key
RECIPIENT=0x...         # Token recipient
TOKEN=0x...             # Token to send
AMOUNT=10.0             # Human-readable number of tokens to send

# Stargate contract (leave empty to fetch from API automatically)
STARGATE_CONTRACT=

# See signer.env.example for detailed guidance
```

### 3. Approve Token (Standard ERC-20 Only)

**If using standard ERC-20 tokens (like USDT), approve first:**

```bash
cp approve.env.example approve.env
# Edit approve.env with your details
npm run approve
```

**Skip this step** for EIP-3009 tokens (like USDC) - no approval needed!

### 4. Create Payment Authorization

```bash
npm run sign
```

Or directly: `node signer.js`

This creates **four files**:
- `payload.json` - Full x402 payload for POST to facilitator
- `payment-header.txt` - Base64 string for X-PAYMENT HTTP header
- `x402-payment.json` - Decoded payment object (for debugging)
- `payloads/payload-TIMESTAMP.json` - Timestamped backup

### 5. Use the Payment

**Option 1: Send to x402-Compatible Resource Server (Standard x402)**

Use the `X-PAYMENT` header to pay for and access resources in one request:

**Windows PowerShell:**
```powershell
$header = Get-Content payment-header.txt -Raw
curl.exe -H "X-PAYMENT: $header" https://api.example.com/paid-endpoint
```

**Linux / macOS / Git Bash:**
```bash
curl -H "X-PAYMENT: $(cat payment-header.txt)" \
     https://api.example.com/paid-endpoint
```

The resource server will verify your payment with a facilitator and return the data.

**Option 2: Direct Settlement via Facilitator**

Send directly to the Megalith facilitator for payment settlement without resource access:

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/settle \
     -H "Content-Type: application/json" \
     -d @payload.json
```

---

## x402 Payment Flow

### Standard x402 Flow (Resource Access)

```
1. Client → Resource Server: GET /api/data
2. Resource Server → Client: 402 Payment Required + payment details
3. Client signs payment locally (signer.js)
4. Client → Resource Server: GET /api/data + X-PAYMENT header
5. Resource Server → Facilitator: Verify & settle payment
6. Resource Server → Client: 200 OK + the actual data
```

### Direct Settlement Flow (No Resource)

```
1. Client signs payment locally (signer.js)
2. Client → Facilitator: POST /settle with payload
3. Facilitator → Blockchain: Broadcast transaction
4. Facilitator → Client: Transaction receipt
```

Both flows use the same signed authorization - the difference is who calls the facilitator!

---

## Scheme Field and Facilitator Compatibility

### How This Signer Sets the Scheme

This signer **intelligently sets the scheme based on token type detection**:
- ✅ **EIP-3009 tokens** (like USDC) → `scheme: "eip3009"` (native authorization)
- ✅ **Standard ERC-20 tokens** (like USDT) → `scheme: "exact"` (Stargate proxy)

The signer automatically detects the token type and sets the correct scheme.

### How It Works

1. **Signer detects token type** by calling `authorizationState()` on the token
2. **If EIP-3009 detected**:
   - Signs with EIP-3009 `transferWithAuthorization` format
   - Sets `scheme: "eip3009"`
3. **If standard ERC-20 detected**:
   - Signs with Stargate proxy format
   - Sets `scheme: "exact"`

### Compatibility with Facilitators

**This signer works with:**
- ✅ **Megalith facilitator** - Accepts both schemes and has auto-detection fallback
- ✅ **Facilitators that require explicit schemes** - Signer provides correct scheme
- ✅ **Facilitators with auto-detection** - Scheme hint makes routing faster

**Why both approaches work:**
- The **scheme field** tells the facilitator which method was used
- The **Megalith facilitator** can also auto-detect as a fallback if needed
- If scheme and signature mismatch, verification fails safely

### Trust Model

- The signer **detects and labels** the payment method via the `scheme` field
- The facilitator **trusts but verifies** - signature must match the claimed scheme
- If the signature doesn't match the scheme, verification fails safely
- This provides both performance (via scheme hint) and security (via verification)

---

## Token Approval (Standard ERC-20 Only)

Before creating payments with standard ERC-20 tokens, you must approve the MegalithStargate contract.

### Quick Approval

```bash
cp approve.env.example approve.env
# Edit approve.env with your details
npm run approve
```

**What gets approved?**
The MegalithStargate contract needs permission to transfer tokens from your wallet. This is a one-time approval per token (unless you revoke it or the contract upgrades).

**Features:**
- ✅ Automatically fetches latest Stargate address from API
- ✅ Shows current allowance before approving
- ✅ Supports "unlimited" approval (recommended)
- ✅ Interactive confirmation prompts with security warnings
- ✅ Color-coded terminal output

**EIP-3009 tokens don't need approval** - they support direct authorization!

---

## x402 Payload Structure

The signer creates x402 v1 compliant payloads:

### For X-PAYMENT Header (Standard x402)

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "56",
  "payload": {
    "authorization": {
      "from": "0x...",
      "to": "0x...",
      "value": "1000000",
      "validAfter": 1730304000,
      "validBefore": 1730307600,
      "nonce": "0x...",
      "v": 27,
      "r": "0x...",
      "s": "0x..."
    }
  }
}
```

This object is base64-encoded and placed in the `X-PAYMENT` HTTP header.

### For Facilitator POST (Direct Settlement)

```json
{
  "x402Version": 1,
  "paymentHeader": "eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoi...",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "56",
    "maxAmountRequired": "1000000",
    "resource": "/api/settlement",
    "description": "Payment of 1.0 USDC",
    "mimeType": "application/json",
    "payTo": "0x...",
    "maxTimeoutSeconds": 30,
    "asset": "0x...",
    "extra": {
      "name": "USD Coin",
      "version": "2"
    }
  }
}
```

Both formats contain the same authorization - just packaged differently for different use cases.

---

## API Endpoints

### Production (x402.megalithlabs.ai)

The Megalith facilitator implements the x402 protocol specification.

#### Verify Payment
Validates the payment authorization without executing it (x402 `/verify` endpoint).

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/verify \
     -H "Content-Type: application/json" \
     -d @payload.json
```

**x402 Response:**
```json
{
  "isValid": true,
  "invalidReason": null,
  "tokenType": "EIP-3009",
  "network": "BNB Chain Mainnet"
}
```

#### Settle Payment
Executes the payment on-chain (x402 `/settle` endpoint).

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/settle \
     -H "Content-Type: application/json" \
     -d @payload.json
```

**x402 Response:**
```json
{
  "txHash": "0x456pqr...",
  "blockNumber": 12345678,
  "gasUsed": "150000",
  "status": "success",
  "network": "BNB Chain Mainnet",
  "method": "EIP-3009 (direct)"
}
```

#### Get Contract Addresses
Get latest Stargate contract addresses for all supported networks.

**Windows PowerShell:**
```powershell
curl.exe https://x402.megalithlabs.ai/contracts
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl https://x402.megalithlabs.ai/contracts
```

**Response:**
```json
{
  "56": {
    "stargate": "0x40200001004B5110333e4De8179426971Efd034A",
    "version": "1.0.0"
  },
  "97": {
    "stargate": "0x40200001004B5110333e4De8179426971Efd034A",
    "version": "1.0.0"
  }
}
```

#### Supported Networks
Get list of supported (scheme, network) pairs (x402 `/supported` endpoint).

**Windows PowerShell:**
```powershell
curl.exe https://x402.megalithlabs.ai/supported
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl https://x402.megalithlabs.ai/supported
```

**x402 Response:**
```json
[
  {
    "scheme": "universal",
    "network": 56,
    "networkName": "BNB Chain Mainnet",
    "description": "Universal settlement (auto-detects EIP-3009 or ERC-20) on BNB Chain Mainnet",
    "method": "settle",
    "supportsEIP3009": true,
    "supportsERC20": true
  },
  {
    "scheme": "universal",
    "network": 97,
    "networkName": "BNB Chain Testnet",
    "description": "Universal settlement (auto-detects EIP-3009 or ERC-20) on BNB Chain Testnet",
    "method": "settle",
    "supportsEIP3009": true,
    "supportsERC20": true
  }
]
```

#### Health Check

**Windows PowerShell:**
```powershell
curl.exe https://x402.megalithlabs.ai/health
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl https://x402.megalithlabs.ai/health
```

**Response:**
```json
{
  "status": "healthy",
  "facilitator": "Universal x402-compliant (EIP-3009 + ERC-20)",
  "methods": ["settle (universal auto-detect)"],
  "networks": {
    "56": {
      "name": "BNB Chain Mainnet",
      "rpcConfigured": true,
      "keyConfigured": true,
      "facilitatorContract": "0x40200001004B5110333e4De8179426971Efd034A"
    },
    "97": {
      "name": "BNB Chain Testnet",
      "rpcConfigured": true,
      "keyConfigured": true,
      "facilitatorContract": "0x40200001004B5110333e4De8179426971Efd034A"
    }
  }
}
```

---

## Configuration

### Signer Configuration (signer.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NETWORK` | Yes | Chain ID (56=BNB mainnet, 97=BNB testnet) | `56` |
| `PAYER_KEY` | Yes | Private key of payer | `0x1234...` |
| `RECIPIENT` | Yes | Payment recipient address | `0x5678...` |
| `TOKEN` | Yes | Token contract address | `0xabcd...` |
| `AMOUNT` | Yes | Amount in human-readable units | `10.0` |
| `STARGATE_CONTRACT` | No | Manual Stargate override (leave empty for auto-fetch) | `` |
| `FACILITATOR_API` | No | Facilitator endpoint (defaults to Megalith) | `https://x402.megalithlabs.ai` |

### Approval Configuration (approve.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NETWORK` | Yes | Chain ID (56=BNB mainnet, 97=BNB testnet) | `56` |
| `APPROVER_KEY` | Yes | Private key of approver | `0x1234...` |
| `TOKEN` | Yes | Token contract address | `0x55d3...` |
| `STARGATE_CONTRACT` | No | Manual Stargate override (leave empty for auto-fetch) | `` |
| `AMOUNT` | No | Approval amount ("unlimited" or specific) | `unlimited` |
| `FACILITATOR_API` | No | Facilitator endpoint for contract lookup | `https://x402.megalithlabs.ai` |

### AMOUNT Configuration - Human-Readable Format

**Write the amount you want to send in normal units** (e.g., "10.5" for ten-and-a-half tokens).

The script automatically:
1. Fetches the token's decimal places from the blockchain
2. Converts to base units (wei) for you
3. Shows the conversion for verification before signing

**Examples:**
```bash
# For USDT (18 decimals)
AMOUNT=1.0     # Sends 1 USDT = 1000000000000000000 base units
AMOUNT=0.1     # Sends 0.1 USDT = 100000000000000000 base units
AMOUNT=10.5    # Sends 10.5 USDT = 10500000000000000000 base units

# For USDC (6 decimals)  
AMOUNT=1.0     # Sends 1 USDC = 1000000 base units
AMOUNT=0.1     # Sends 0.1 USDC = 100000 base units
AMOUNT=100     # Sends 100 USDC = 100000000 base units

# For WBTC (8 decimals)
AMOUNT=0.5     # Sends 0.5 WBTC = 50000000 base units
```

**⚠️ Always verify:** The script displays the base units before signing - double-check it!

### Network Configuration

**BNB Chain Mainnet (56):**
- RPC: `https://bsc-dataseed.binance.org/`
- Stargate: Auto-fetched from API
- x402 Scheme: `exact` on network `56`

**BNB Chain Testnet (97):**
- RPC: `https://data-seed-prebsc-1-s1.binance.org:8545/`
- Stargate: Auto-fetched from API
- x402 Scheme: `exact` on network `97`

**Current Stargate:** `0x40200001004B5110333e4De8179426971Efd034A` (v1.0.0)

---

## Token Types

### EIP-3009 Tokens (e.g., USDC)
- ✅ No approval required
- ✅ Direct authorization via `transferWithAuthorization`
- ✅ Gasless for payer (facilitator pays gas)
- ✅ `STARGATE_CONTRACT` not needed
- 📋 x402 scheme: `exact` with native EIP-3009 support

### Standard ERC-20 Tokens (e.g., USDT)
- ⚠️ Requires approval first (use `npm run approve`)
- ⚠️ Uses MegalithStargate contract for x402 compatibility
- ✅ Approval is one-time per token
- ✅ Stargate address auto-fetched from API
- ✅ Gasless for payer (facilitator pays gas)
- 📋 x402 scheme: `exact` via Stargate proxy

The MegalithStargate contract brings x402 payment capabilities to all standard ERC-20 tokens by implementing the same `exact` payment scheme that EIP-3009 tokens have natively.

**To approve a standard ERC-20 token:**
```bash
npm run approve
```

Or manually via block explorer - see [Troubleshooting](#troubleshooting) below.

---

## Token Approval Details

### approve.js Configuration

**approve.env variables:**
```bash
NETWORK=56                  # 56=BNB mainnet, 97=BNB testnet
APPROVER_KEY=0x...          # Wallet that holds the tokens
TOKEN=0x55d3...             # Token contract address
STARGATE_CONTRACT=          # Leave empty (auto-fetched)
AMOUNT=unlimited            # "unlimited" or specific amount
```

### Common Token Addresses

**BNB Chain Mainnet (Chain ID 56):**
| Token | Type | Address |
|-------|------|---------|
| USDT | ERC-20 | `0x55d398326f99059fF775485246999027B3197955` |
| USDC | EIP-3009 | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| BUSD | ERC-20 | `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56` |

### Approval Amount Options

**Unlimited (Recommended):**
```bash
AMOUNT=unlimited
```
- ✅ One-time approval for all future x402 payments
- ✅ Saves gas on subsequent transactions
- ⚠️ Gives Stargate permission to spend any amount (with your signed authorization)
- ⚠️ Only approve trusted contracts

**Specific Amount:**
```bash
AMOUNT=1000.0
```
- ✅ Limits approval to exact amount
- ❌ Need new approval when depleted
- ❌ More gas fees over time

### Approval Workflow

```bash
# 1. Configure
cp approve.env.example approve.env
nano approve.env

# 2. Run approval
npm run approve

# 3. Confirm transaction
# (Interactive prompt with security warnings)

# 4. Wait for confirmation
# ✓ Approval successful!

# 5. Now you can create x402 payments
npm run sign
```

---

## File Structure

```
signer/
├── signer.js                 # x402 payment signing script
├── signer.env                # Your signer config (DO NOT COMMIT)
├── signer.env.example        # Signer config template
├── approve.js                # Token approval script (for ERC-20)
├── approve.env               # Your approval config (DO NOT COMMIT)
├── approve.env.example       # Approval config template
├── package.json              # Dependencies
├── payload.json              # Latest x402 payload (facilitator POST format)
├── payment-header.txt        # Base64 for X-PAYMENT header
├── x402-payment.json         # Decoded x402 payment object
├── payloads/                 # Archived payloads
│   ├── payload-2025-10-30T14-23-50.json
│   ├── payload-2025-10-30T15-45-12.json
│   └── ...
└── README.md                 # This file
```

**`.gitignore` should include:**
```
signer.env
approve.env
node_modules/
payload.json
payment-header.txt
x402-payment.json
payloads/
```

---

## Security Best Practices

### 🔐 Private Key Safety
- **NEVER** commit `signer.env` or `approve.env` to git
- **NEVER** share your private key
- Use environment variables or secure key management
- Consider using a hardware wallet for production
- The facilitator **CANNOT** move your funds without your signature

### 🕒 Time Validity
- x402 authorizations are valid for **1 hour** by default
- Expired authorizations are automatically rejected by x402 facilitators
- Create new authorizations if expired

### 💰 Amount Limits
- x402 uses `maxAmountRequired` to cap payment amounts
- Double-check the `AMOUNT` before signing
- Script shows human-readable amount for confirmation
- Always verify base units match your intention

### 🌐 Network Selection
- **Always verify** you're on the correct network in x402 payloads
- Mainnet (56) = real money
- Testnet (97) = test tokens only
- Script displays network in x402 payload clearly

### ⚠️ Unlimited Approvals (ERC-20 Only)
- Only approve contracts you trust
- MegalithStargate is audited and non-custodial
- Can revoke approvals anytime via block explorer
- Consider specific amounts for extra caution
- The contract **CANNOT** move tokens without your signed x402 authorization

### 🔒 x402 Trust Model
You trust:
- ✅ MegalithStargate contract (audited, open source, non-custodial)
- ✅ Your own signed authorizations (you control the private key)

You don't need to trust:
- ❌ The facilitator (cannot move funds without your signature)
- ❌ The recipient (cannot pull funds, only receive what you authorize)
- ❌ The resource server (just forwards payment to facilitator)

---

## Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install
```

### "Could not fetch Stargate contract from API"
If the API is unavailable, you can manually set the Stargate address:

**In signer.env or approve.env:**
```bash
STARGATE_CONTRACT=0x40200001004B5110333e4De8179426971Efd034A
```

### "Insufficient allowance" or Settlement Reverts
For standard ERC-20 tokens, run the approval tool:

```bash
npm run approve
```

**Or manually approve via block explorer:**

1. Go to token contract on BscScan
2. Connect wallet (Write Contract tab)
3. Call `approve` function:
   ```
   spender: 0x40200001004B5110333e4De8179426971Efd034A
   amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935
   ```
   (This is max uint256 for unlimited approval)

### "Payment verification failed" (x402 /verify endpoint)

- Check if authorization expired (1 hour validity)
- Verify payer has sufficient balance
- Ensure correct network in x402 payload
- Confirm token address is correct
- Check x402Version is 1
- **Scheme field**: Megalith facilitator accepts "exact" and auto-detects token type
  - Other facilitators may require specific schemes
  - See "Scheme Field and Facilitator Compatibility" section above

### "Invalid signature" (x402 payload issue)
- Verify `PAYER_KEY` is correct
- Check that signer matches the `from` address in authorization
- Ensure no modifications to payload.json after signing
- Verify EIP-712 domain matches token/contract requirements

### Transaction Reverts with "status: 0"
This usually means:
1. **Insufficient allowance** (ERC-20) - Run `npm run approve`
2. **Nonce already used** - Create new payment with `npm run sign`
3. **Insufficient balance** - Payer doesn't have enough tokens
4. **Insufficient gas** - Facilitator needs more BNB (should not happen)
5. **Authorization expired** - Create fresh authorization

### Windows PowerShell curl Issues
Use `curl.exe` with `--%` flag:
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

### "APPROVER_KEY" vs "PAYER_KEY" Confusion
- **APPROVER_KEY** (approve.env) = Wallet that holds the tokens for approval
- **PAYER_KEY** (signer.env) = Wallet that signs the x402 payment authorization

Usually these are the same wallet, but they can be different.

### Payment Archives
Old payloads in `payloads/` folder are kept for audit purposes. They expire after 1 hour and can be safely deleted:
```bash
rm -rf payloads/
```

### x402 Payload Format Issues
If you're integrating with a different x402 facilitator and getting errors:
- Verify they support x402 v1
- Check if they support the schemes this signer uses (`eip3009` and `exact`)
  - Megalith facilitator: accepts both schemes with auto-detection fallback
  - Other facilitators: may require specific scheme values
  - This signer automatically sets the correct scheme based on token detection
- Confirm network ID format (string vs number)
- Test with `/verify` endpoint first before `/settle`

---

## NPM Scripts

```bash
npm run sign      # Create x402 payment authorization (node signer.js)
npm run approve   # Approve tokens for Stargate (node approve.js)
```

Or run directly:
```bash
node signer.js
node approve.js
```

---

## x402 Protocol Specifications

This implementation follows the x402 v1 specification:

### Supported Schemes

This signer **automatically sets the correct scheme** based on token detection:

**How the signer determines scheme:**
1. Detects if token implements EIP-3009 (by checking `authorizationState` function)
2. **EIP-3009 tokens** → Sets `scheme: "eip3009"`
3. **Standard ERC-20 tokens** → Sets `scheme: "exact"`

**Available schemes:**
- `eip3009` - Native EIP-3009 authorization (used for USDC and similar tokens)
- `exact` - Stargate proxy authorization (used for standard ERC-20 tokens like USDT)

**Facilitator compatibility:**
- **Megalith facilitator** accepts both schemes and has auto-detection fallback
- **Other facilitators** may require specific schemes - this signer provides them correctly
- The scheme field serves as a **performance hint** while signatures provide **security**

### Supported Networks
- `56` (BNB Chain Mainnet)
- `97` (BNB Chain Testnet)

### Payment Methods
- **EIP-3009**: Native `transferWithAuthorization`
- **ERC-20 + Stargate**: Proxy authorization via MegalithStargate

### Signature Standard
- **EIP-712**: Typed structured data signing
- Prevents signature replay across chains and contracts

### Settlement
- Facilitator broadcasts transaction on-chain
- Instant finality (~200ms on BNB Chain)
- Gasless for payer (facilitator pays gas)

---

## Support

- 🌐 Website: https://megalithlabs.ai
- 🌐 x402 Protocol: https://x402.org
- 📧 Email: support@megalithlabs.ai
- 🐛 Issues: https://github.com/megalithlabs/x402/issues
- 📚 Docs: https://github.com/MegalithLabs/x402

---

## License

MIT License - see LICENSE file for details

---

## Changelog

### v2.1.0 (Current)
- **Clarified Scheme Behavior**: Documentation now explains that signer uses "exact" for all tokens
- **Facilitator Auto-Detection**: Megalith facilitator now intelligently auto-detects token types
- **Better Compatibility**: Works with any x402 facilitator (with or without auto-detection)
- **Enhanced Documentation**: Added section on scheme field and trust model

### v2.0.0
- **x402 Protocol Compliance**: Full x402 v1 specification support
- **Dual Output Format**: Creates both X-PAYMENT header and facilitator POST formats
- **New Files**: payment-header.txt and x402-payment.json for flexibility
- **Enhanced Payload**: Added x402Version, scheme, maxAmountRequired, etc.
- **Updated Documentation**: Complete x402 terminology and usage patterns

### v1.1.0
- Added token approval tool (approve.js)
- API contract fetching for latest Stargate addresses
- Improved configuration with auto-detection
- Enhanced error messages and troubleshooting

### v1.0.0
- Initial release
- EIP-3009 and standard ERC-20 support
- Multi-network support (BNB Chain)
- Automatic token type detection
- Payload archiving