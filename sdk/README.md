# @megalithlabs/x402-sdk

JavaScript SDK for x402 payments - create and settle crypto payments in 3 lines of code.

**Part of the x402 protocol**: An open standard for internet-native payments using HTTP 402 status codes.

Learn more: [x402.org](https://x402.org) | [Megalith Labs](https://megalithlabs.ai)

---

## Installation

```bash
npm install @megalithlabs/x402-sdk
```

Or install directly from GitHub:

```bash
npm install github:MegalithLabs/x402
```

---

## Quick Start

```javascript
const { X402Client } = require('@megalithlabs/x402-sdk');

// Initialize client
const client = new X402Client({
  privateKey: process.env.PRIVATE_KEY,
  network: 'base'  // or 'bsc', 'base-sepolia', 'bsc-testnet'
});

// Pay in one line
const result = await client.pay({
  to: '0xRecipientAddress...',
  amount: '1.00',
  token: '0xUSDCAddress...'
});

console.log('Payment settled:', result.txHash);
```

---

## API Reference

### Constructor

```javascript
new X402Client({
  privateKey,      // Required: Wallet private key
  network,         // Required: 'bsc', 'bsc-testnet', 'base', 'base-sepolia'
  facilitatorUrl,  // Optional: Custom facilitator (default: https://x402.megalithlabs.ai)
  rpcUrl           // Optional: Custom RPC URL
})
```

### Methods

| Method | Description |
|--------|-------------|
| `pay({ to, amount, token })` | Create and settle payment in one call |
| `createPayment({ to, amount, token })` | Create signed payload without settling |
| `settlePayment(payload)` | Settle an existing payload |
| `verifyPayment(payload)` | Verify payload without settling |
| `getAddress()` | Get wallet address |
| `getNetworkInfo()` | Get current network details |
| `getSupported()` | Get supported networks from facilitator |

### Payment Options

```javascript
{
  to: '0x...',      // Recipient address
  amount: '1.50',   // Amount as decimal string
  token: '0x...'    // Token contract address
}
```

---

## Supported Networks

| Network | Chain ID | Description |
|---------|----------|-------------|
| `base` | 8453 | Base Mainnet |
| `base-sepolia` | 84532 | Base Testnet |
| `bsc` | 56 | BNB Chain Mainnet |
| `bsc-testnet` | 97 | BNB Chain Testnet |

---

## Token Support

### EIP-3009 Tokens (Direct Authorization)
- **USDC** - No approval needed
- **EURC** - No approval needed

### Standard ERC-20 Tokens (via Stargate)
- **USDT**, **DAI**, **BUSD**, and any ERC-20
- Requires one-time approval: `npm run approve` in `tools/`

---

## Advanced Usage

### Create Payment Without Settling

```javascript
// Create signed payload
const payload = await client.createPayment({
  to: '0x...',
  amount: '5.00',
  token: '0x...'
});

// Verify it's valid
const verification = await client.verifyPayment(payload);
console.log('Valid:', verification.valid);

// Settle when ready
const result = await client.settlePayment(payload);
```

### Custom RPC URL

```javascript
const client = new X402Client({
  privateKey: '0x...',
  network: 'base',
  rpcUrl: 'https://your-custom-rpc.com'
});
```

### Custom Facilitator

```javascript
const client = new X402Client({
  privateKey: '0x...',
  network: 'base',
  facilitatorUrl: 'https://your-facilitator.com'
});
```

---

## CLI Tools

The SDK includes command-line tools in the `tools/` directory:

```bash
# Create payment authorization (interactive)
npm run signer

# Approve Stargate for ERC-20 tokens
npm run approve
```

See `tools/README.md` for detailed CLI documentation.

---

## Examples

See the `examples/` directory for complete examples:

- `basic-payment.js` - Simple payment flow

---

## How It Works

1. **Token Detection**: SDK automatically detects if token supports EIP-3009
2. **Signature Creation**: Creates EIP-712 typed signature for authorization
3. **Facilitator Settlement**: Sends to facilitator API which executes on-chain
4. **Gas Fees**: Facilitator pays gas - you only pay the token amount

---

## Error Handling

```javascript
try {
  const result = await client.pay({ to, amount, token });
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    // Handle low balance
  } else if (error.message.includes('Insufficient Stargate approval')) {
    // Need to run: npm run approve
  } else {
    // Other error
  }
}
```

---

## Support

- Website: https://megalithlabs.ai
- x402 Protocol: https://x402.org
- Issues: https://github.com/MegalithLabs/x402/issues
- Email: support@megalithlabs.ai

---

## License

MIT License - see [LICENSE](../LICENSE)
