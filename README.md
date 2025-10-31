# Megalith x402

**x402-compliant payment system** for EVM-compatible blockchains supporting both EIP-3009 and standard ERC-20 tokens.

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

---

## Repository Contents

- **[Signer/](Signer/)** - Client tool to create x402-compliant payment authorizations → **Start here!**
- **[Contracts/](Contracts/)** - MegalithStargate smart contract source

---

## Quick Start

```bash
cd Signer
npm install
cp signer.env.example signer.env
# Edit signer.env with your details
node signer.js
```

**Full documentation:** [Signer/README.md](Signer/README.md)

---

## MegalithStargate Smart Contract

Enables x402 payments with standard ERC-20 tokens that lack native EIP-3009 support.

**Current Deployments (v1.0.0):**

| Network | Chain ID | Contract Address |
|---------|----------|------------------|
| **BNB Chain Mainnet** | 56 | `0x40200001004b5110333e4de8179426971efd034a` |
| **BNB Chain Testnet** | 97 | `0x40200001004b5110333e4de8179426971efd034a` |

**Source:** [Contracts/Stargate.sol](Contracts/Stargate.sol)

---

## x402 Facilitator API

**Production:** https://x402.megalithlabs.ai

### Standard x402 Endpoints

- **`POST /verify`** - Validate payment authorization signature
- **`POST /settle`** - Execute payment on-chain and settle
- **`GET /supported`** - List supported payment schemes and networks

### Additional Endpoints

- **`GET /contracts`** - Get current Stargate contract addresses
- **`GET /health`** - Service health check

---

## Supported Networks

**Currently supported:**
- ✅ **BNB Chain Mainnet** (Chain ID: 56)
- ✅ **BNB Chain Testnet** (Chain ID: 97)

---

## Token Support

### EIP-3009 Tokens (Native Support)
- ✅ **USDC** - Direct authorization, no approval needed
- ✅ **EURC** - Direct authorization, no approval needed

### Standard ERC-20 Tokens (via Stargate)
- ✅ **USDT** - Requires one-time approval
- ✅ **DAI** - Requires one-time approval
- ✅ **BUSD** - Requires one-time approval
- ✅ **Any ERC-20** - Just approve once, then sign payments

**Note:** Standard ERC-20 tokens require running `npm run approve` once before creating payment authorizations.

---

## Support

- 🌐 Website: https://megalithlabs.ai
- 🌐 x402 Protocol: https://x402.org
- 📧 Email: support@megalithlabs.ai
- 🐛 Issues: https://github.com/megalithlabs/x402/issues
- 📚 Docs: [Signer/README.md](Signer/README.md)

---

## License

MIT License - see [LICENSE](LICENSE)

---