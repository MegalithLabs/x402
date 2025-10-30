<!-- test -->
# Megalith x402

Payment authorization system for EVM-compatible blockchains supporting EIP-3009 and ERC-20 tokens.

## What's This?

x402 enables signed payment authorizations that can be executed by a facilitator service. Users sign payments locally, and the facilitator submits them on-chain.

**Perfect for:**
- Gasless payments (facilitator pays gas)
- Delegated transfers
- Multi-chain payment systems and apps

## Repository Contents

- **[signer/](signer/)** - Client tool to create signed payments → **Start here!**
- **[contracts/](contracts/)** - Megalith Stargate smart contract source
- **[docs/](docs/)** - API reference and guides

## Quick Start

1. Install the signer:
   ```bash
   cd signer
   npm install
   ```

2. Configure and run:
   ```bash
   cp signer.env.example signer.env
   # Edit signer.env with your details
   node signer.js
   ```

3. Send payment to facilitator:
   
   **Windows PowerShell:**
   ```powershell
   curl.exe -X POST https://x402.megalithlabs.ai/settle --% -H "Content-Type: application/json" -d @payload.json
   ```
   
   **Linux / macOS / Git Bash:**
   ```bash
   curl -X POST https://x402.megalithlabs.ai/settle \
     -H "Content-Type: application/json" \
     -d @payload.json
   ```

**Full documentation:** [signer/README.md](signer/README.md)

## API

**Production:** https://x402.megalithlabs.ai

**Endpoints:**
- `POST /verify` - Validate payment authorization
- `POST /settle` - Execute payment on-chain
- `GET /supported` - List supported networks
- `GET /health` - Service health check

See [docs/API.md](docs/API.md) for details.

## Stargate smart contract
Enables x402 payments with standard ERC-20 tokens lacking EIP-3009 compatibility.

**Current Deployments (v1):**

**BNB Chain Mainnet:**  
`0x40200001004b5110333e4de8179426971efd034a`

**BNB Chain Testnet:**  
`0x40200001004b5110333e4de8179426971efd034a`

The MegalithStargate contract handles standard ERC-20 token transfers with facilitator authorization.

## Architecture

```
┌─────────┐         ┌──────────────┐         ┌────────────┐
│  User   │ signs   │ Facilitator  │ submits │ Blockchain │
│ (signer)│───────▶│   (Megalith)  │───────▶│  (BNB)     │
└─────────┘         └──────────────┘         └────────────┘
```

1. **User** creates signed payment authorization locally (no gas needed)
2. **Facilitator** validates and executes the payment on-chain (pays gas)
3. **Blockchain** transfers tokens according to the authorization

## Supported Networks

**Currently supported:**
- ✅ **BNB Chain Mainnet** (Chain ID: 56)
- ✅ **BNB Chain Testnet** (Chain ID: 97)

Additional EVM chains coming soon. The system is designed to work with any EVM-compatible blockchain.

## Token Support

- ✅ **EIP-3009 tokens** (e.g., USDC) - Direct authorization
- ✅ **Standard ERC-20** (e.g., USDT) - Via MegalithStargate contract

## License

MIT License - see [LICENSE](LICENSE)

---

**Website:** https://megalithlabs.ai  
**Support:** support@megalithlabs.ai
