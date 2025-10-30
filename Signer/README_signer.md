# Megalith x402 Payment Signer

Create signed payment authorizations for both EIP-3009 and standard ERC-20 tokens for supported networks.

## Important: Terminal Differences

**Different terminals handle curl differently:**

### Windows PowerShell (Most Windows Users)
Use `curl.exe` with the `--%` flag:
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

### Windows CMD / Git Bash / Linux / macOS
Use standard `curl`:
```bash
curl -X POST https://x402.megalithlabs.ai/verify -H "Content-Type: application/json" -d @payload.json
```

**All examples below show both formats.**

---

## Features

- ✅ **EIP-3009 Support**: Direct authorization for USDC and other EIP-3009 tokens
- ✅ **Standard ERC-20 Support**: Works with any ERC-20 token via MegalithStargate
- ✅ **Multi-Network**: V1 supports BNB Chain Mainnet (56) and Testnet (97)
- ✅ **Automatic Detection**: Auto-detects token type and configures appropriately
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
NETWORK=56			# 56=BNB Mainnet, 97=BNB testnet
PAYER_KEY=0x...			# Your private key
RECIPIENT=0x...		# Token recipient
TOKEN=0x...			# Token to send
AMOUNT=10.0			# Human-readable number of tokens to send

# Stargate contract (leave empty to fetch from API automatically)
STARGATE_CONTRACT=

# See signer.env for more guidance on all fields
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

This creates:
- `payload.json` - Ready to send to facilitator
- `payloads/payload-TIMESTAMP.json` - Archived copy

### 5. Test the Payment

**Verify the payment (validates without executing):**

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/verify -H "Content-Type: application/json" -d @payload.json
```

**Execute the payment:**

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/settle -H "Content-Type: application/json" -d @payload.json
```

---

## Token Approval (Standard ERC-20 Only)

Before creating payments with standard ERC-20 tokens, you must approve the Stargate contract.

### Quick Approval

```bash
cp approve.env.example approve.env
# Edit approve.env with your details
npm run approve
```

**What gets approved?**
The MegalithStargate contract needs permission to transfer tokens from your wallet. This is a one-time approval per token (unless you revoke it or Stargate upgrades).

**Features:**
- ✅ Automatically fetches latest Stargate address from API
- ✅ Shows current allowance before approving
- ✅ Supports "unlimited" approval (recommended)
- ✅ Interactive confirmation prompts
- ✅ Color-coded terminal output

**EIP-3009 tokens don't need approval** - they support direct authorization!

---

## API Endpoints

### Production (x402.megalithlabs.ai)

#### Verify Payment
Validates the payment authorization without executing it.

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/verify -H "Content-Type: application/json" -d @payload.json
```

**Response:**
```json
{
  "valid": true,
  "message": "Payment authorization is valid",
  "details": {
    "from": "0x1234...",
    "to": "0x5678...",
    "amount": "100000000000000000",
    "token": "0xabcd...",
    "network": 56
  }
}
```

#### Settle Payment
Executes the payment on-chain.

**Windows PowerShell:**
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl -X POST https://x402.megalithlabs.ai/settle -H "Content-Type: application/json" -d @payload.json
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x456pqr...",
  "message": "Payment settled successfully"
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
Get list of supported networks.

**Windows PowerShell:**
```powershell
curl.exe https://x402.megalithlabs.ai/supported
```

**Windows CMD / Git Bash / Linux / macOS:**
```bash
curl https://x402.megalithlabs.ai/supported
```

**Response:**
```json
{
  "networks": [
    {
      "id": 56,
      "name": "BNB Chain Mainnet",
      "rpc": "https://bsc-dataseed.binance.org/"
    },
    {
      "id": 97,
      "name": "BNB Chain Testnet",
      "rpc": "https://data-seed-prebsc-1-s1.binance.org:8545/"
    }
  ]
}
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
  "timestamp": "2025-10-30T14:23:50.123Z"
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

### Approval Configuration (approve.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NETWORK` | Yes | Chain ID (56=BNB mainnet, 97=BNB testnet) | `56` |
| `APPROVER_KEY` | Yes | Private key of approver | `0x1234...` |
| `TOKEN` | Yes | Token contract address | `0x55d3...` |
| `STARGATE_CONTRACT` | No | Manual Stargate override (leave empty for auto-fetch) | `` |
| `AMOUNT` | No | Approval amount ("unlimited" or specific) | `unlimited` |

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

**BNB Chain Testnet (97):**
- RPC: `https://data-seed-prebsc-1-s1.binance.org:8545/`
- Stargate: Auto-fetched from API

**Current Stargate:** `0x40200001004B5110333e4De8179426971Efd034A` (v1.0.0)

---

## Token Types

### EIP-3009 Tokens (e.g., USDC)
- ✅ No approval required
- ✅ Direct authorization via `transferWithAuthorization`
- ✅ Gasless for payer
- ✅ `STARGATE_CONTRACT` not needed

### Standard ERC-20 Tokens (e.g., USDT)
- ⚠️ Requires approval first (use `npm run approve`)
- ⚠️ Uses MegalithStargate contract
- ✅ Approval is one-time per token
- ✅ Stargate address auto-fetched from API

The Stargate contract is needed because standard ERC-20 tokens don't support the `transferWithAuthorization` function that EIP-3009 tokens have. MegalithStargate brings x402 payments to all ERC-20 tokens.

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

**BNB Chain Mainnet:**
| Token | Address |
|-------|---------|
| USDT | `0x55d398326f99059fF775485246999027B3197955` |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| BUSD | `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56` |

### Approval Amount Options

**Unlimited (Recommended):**
```bash
AMOUNT=unlimited
```
- ✅ One-time approval for all future payments
- ✅ Saves gas on subsequent transactions
- ⚠️ Gives Stargate permission to spend any amount
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
# (Interactive prompt with warnings)

# 4. Wait for confirmation
# ✓ Approval successful!

# 5. Now you can create payments
npm run sign
```

---

## File Structure

```
signer/
├── signer.js                 # Payment signing script
├── signer.env                # Your signer config (DO NOT COMMIT)
├── signer.env.example        # Signer config template
├── approve.js                # Token approval script
├── approve.env               # Your approval config (DO NOT COMMIT)
├── approve.env.example       # Approval config template
├── package.json              # Dependencies
├── payload.json              # Latest signed payload (overwrites)
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
payloads/
```

---

## Security Best Practices

### 🔐 Private Key Safety
- **NEVER** commit `signer.env` or `approve.env` to git
- **NEVER** share your private key
- Use environment variables or secure key management
- Consider using a hardware wallet for production

### 🕒 Time Validity
- Authorizations are valid for **1 hour** by default
- Expired authorizations are automatically rejected
- Create new authorizations if expired

### 💰 Amount Limits
- Double-check the `AMOUNT` before signing
- Script shows human-readable amount for confirmation
- Always verify base units match your intention

### 🌐 Network Selection
- **Always verify** you're on the correct network
- Mainnet (56) = real money
- Testnet (97) = test tokens only
- Script displays current network clearly

### ⚠️ Unlimited Approvals
- Only approve contracts you trust
- MegalithStargate is audited and secure
- Can revoke approvals anytime via block explorer
- Consider specific amounts for extra caution

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

### "Payment verification failed"

- Check if authorization expired (1 hour validity)
- Verify payer has sufficient balance
- Ensure correct network configuration
- Confirm token address is correct

### "Invalid signature"
- Verify `PAYER_KEY` is correct
- Check that signer matches the payer address
- Ensure no modifications to payload.json after signing

### Transaction Reverts with "status: 0"
This usually means:
1. **Insufficient allowance** - Run `npm run approve`
2. **Nonce already used** - Create new payment with `npm run sign`
3. **Insufficient balance** - Payer doesn't have enough tokens
4. **Insufficient gas** - Payer needs more BNB (for approve.js only)

### Windows PowerShell curl Issues
Use `curl.exe` with `--%` flag:
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

### "APPROVER_KEY" vs "PAYER_KEY" Confusion
- **APPROVER_KEY** (approve.env) = Wallet that holds the tokens for approval
- **PAYER_KEY** (signer.env) = Wallet that signs the payment authorization

Usually these are the same wallet, but they can be different.

### Payment Archives
Old payloads in `payloads/` folder are kept for audit purposes. They expire after 1 hour and can be safely deleted:
```bash
rm -rf payloads/
```

---

## NPM Scripts

```bash
npm run sign      # Create payment authorization (node signer.js)
npm run approve   # Approve tokens for Stargate (node approve.js)
```

Or run directly:
```bash
node signer.js
node approve.js
```

---

## Support

- 🌐 Website: https://megalithlabs.ai
- 📧 Email: support@megalithlabs.ai
- 🐛 Issues: https://github.com/megalithlabs/x402/issues

---

## License

MIT License - see LICENSE file for details

---

## Changelog

### v1.1.0 (Upcoming)
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
