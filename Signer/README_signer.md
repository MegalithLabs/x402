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
NETWORK=00			# e.g. 56=BNB Mainnet, 97=BNB testnet
PAYER_KEY=0x...			# Your private key
RECIPIENT=0x...		# Token recipient
TOKEN=0x...			# Token to send
AMOUNT=0.0			# Human-readable number of tokens to send

STARGATE_CONTRACT_MAINNET=0x40200001004b5110333e4de8179426971efd034a

# Stargate CA not required for EIP-3009 transfers
# Check latest version at x402.megalithlabs.ai
# See signer.env for more guidance on all fields
```

### 3. Create Payment Authorization

```bash
node signer.js
```

This creates:
- `payload.json` - Ready to send to facilitator
- `payloads/payload-TIMESTAMP.json` - Archived copy

### 4. Test the Payment

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

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NETWORK` | Yes | Chain ID (56=BNBmain, 97=BNBtest) | `56` |
| `PAYER_KEY` | Yes | Private key of payer | `0x1234...` |
| `RECIPIENT` | Yes | Payment recipient address | `0x5678...` |
| `TOKEN` | Yes | Token contract address | `0xabcd...` |
| `AMOUNT` | Yes | Amount in human-readable units (see below) | `10.0` |
| `STARGATE_CONTRACT_MAINNET` | ERC-20 only | Mainnet Stargate address | `0x4020...` |
| `STARGATE_CONTRACT_TESTNET` | ERC-20 only | Testnet Stargate address | `0x4020...` |

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

**⚠️ Always verify:** The script displays:
```
Amount: 10.0 USDT
Token decimals: 18
Base units: 10000000000000000000
```

**Double-check the base units before signing!** This ensures you're sending the correct amount.

### Network Configuration

**BNB Chain Mainnet (56):**
- RPC: `https://bsc-dataseed.binance.org/`
- Stargate: `0x40200001004b5110333e4de8179426971efd034a`

**BNB Chain Testnet (97):**
- RPC: `https://data-seed-prebsc-1-s1.binance.org:8545/`
- Stargate: `0x40200001004b5110333e4de8179426971efd034a`

---

## Token Types

### EIP-3009 Tokens (e.g., USDC)
- ✅ No approval required
- ✅ Direct authorization via `transferWithAuthorization`
- ✅ Gasless for payer
- ✅ `STARGATE_CONTRACT` not needed

### Standard ERC-20 Tokens (e.g., USDT)
- ⚠️ Requires approval first
- ⚠️ Must configure `STARGATE_CONTRACT`
- Uses `permit` or fallback approval mechanism
- MegalithStargate executes the transfer

The Stargate contract is needed because standard ERC-20 tokens don't support the `transferWithAuthorization` function that EIP-3009 tokens have. Stargate is Megalith's solution, bringing x402 payments to all ERC-20 tokens.

**To approve a standard ERC-20 token:**
```bash
# Manually approve via block explorer
# Approval script coming soon
```


## File Structure

```
signer/
├── signer.js                 # Main signing script
├── signer.env                # Your configuration (DO NOT COMMIT)
├── signer.env.example        # Template configuration
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
node_modules/
payload.json
payloads/
```

---

## Security Best Practices

### 🔐 Private Key Safety
- **NEVER** commit `signer.env` to git
- **NEVER** share your private key
- Use environment variables or secure key management
- Consider using a hardware wallet for production

### 🕒 Time Validity
- Authorizations are valid for **1 hour** by default
- Expired authorizations are automatically rejected
- Create new authorizations if expired

### 💰 Amount Limits
- Double-check the `AMOUNT` before signing
- Amounts are in token's base units (usually 18 decimals)
- Script shows human-readable amount for confirmation

### 🌐 Network Selection
- **Always verify** you're on the correct network
- Mainnet (56) = real money
- Testnet (97) = test tokens only
- Script displays current network clearly

---

## Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install dotenv ethers
```

### "STARGATE_CONTRACT not configured"
You're using a standard ERC-20 token. Add to `signer.env`:
```bash
STARGATE_CONTRACT_MAINNET=0x40200001004b5110333e4de8179426971efd034a
```

### "Insufficient allowance" or Settlement Reverts
For standard ERC-20 tokens, token approvals are needed:

**1. Approve the Stargate contract (as payer):**
Go to the token contract on the relevant block explorer and call `approve`:
```
spender: 0x40200001004b5110333e4de8179426971efd034a  (Stargate)
amount: 1000000000000000000000  (large number)
```
Approving a large number of tokens ensures repeated approvals won't be necessary. Approval is one-time; not required by subsequent transactions until your approved amount is consumed. NB if the MegalithStargate contract has been upgraded since you last used it, new approvals will be required for the new contract.


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
1. **Insufficient allowance** - Payer must approve Stargate contract (see above)
2. **Nonce already used** - Create a new payment with `node signer.js`
3. **Insufficient balance** - Payer doesn't have enough tokens

### Windows PowerShell curl Issues
Use `curl.exe` with `--%` flag:
```powershell
curl.exe -X POST https://x402.megalithlabs.ai/verify --% -H "Content-Type: application/json" -d @payload.json
```

### Payment Archives
Old payloads in `payloads/` folder are kept for audit purposes. They expire after 1 hour and can be safely deleted:
```bash
# Clean up old payloads
rm -rf payloads/
```

---


### Debug Mode

Enable verbose logging:
```bash
# Add to signer.env
DEBUG=true

# Run with logging
node signer.js 2>&1 | tee signer.log
```

---

## Support

- 🌐 Website: https://megalithlabs.ai
- 📧 Email: support@megalithlabs.ai
- 📚 Docs: https://docs.megalithlabs.ai
- 🐛 Issues: https://github.com/megalithlabs/x402/issues

---

## License

MIT License - see LICENSE file for details

---

## Changelog

### v1.0.0
- Initial release
- EIP-3009 and standard ERC-20 support
- Multi-network support (BNB Chain)
- Automatic token type detection
- Payload archiving