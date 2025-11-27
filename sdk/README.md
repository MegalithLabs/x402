# @megalithlabs/x402

JavaScript SDK for x402 payments. Pay for APIs and charge for APIs with stablecoins.

**x402** is an open protocol for internet-native payments using HTTP 402 status codes.

Learn more: [x402.org](https://x402.org) | [Megalith Labs](https://megalithlabs.ai)

---

## Installation

```bash
npm install @megalithlabs/x402
```

---

## Quick Start

### Paying for APIs (Payer)

```javascript
const { createSigner, x402Fetch } = require('@megalithlabs/x402');

// Create signer with your wallet
const signer = await createSigner('base', process.env.PRIVATE_KEY);

// Wrap fetch to auto-handle 402 responses
const fetchWithPay = x402Fetch(fetch, signer, { maxAmount: '0.50' });

// Use it like normal fetch - payments happen automatically
const response = await fetchWithPay('https://api.example.com/premium-data');
const data = await response.json();
```

### Charging for APIs (Payee)

```javascript
const express = require('express');
const { x402Express } = require('@megalithlabs/x402');

const app = express();

// Add payment requirement to routes
app.use(x402Express('0xYourWalletAddress', {
  '/api/premium': { price: '$0.01', network: 'base' }
}));

app.get('/api/premium', (req, res) => {
  res.json({ data: 'premium content' });
});

app.listen(3000);
```

---

## API Reference

### createSigner(network, privateKey)

Create a signer for x402 payments.

```javascript
const signer = await createSigner('base', '0xabc123...');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `network` | string | `'base'`, `'base-sepolia'`, `'bsc'`, `'bsc-testnet'` |
| `privateKey` | string | Wallet private key (hex string) |

---

### x402Fetch(fetch, signer, options)

Wrap fetch to automatically handle 402 Payment Required responses.

```javascript
const fetchWithPay = x402Fetch(fetch, signer, { maxAmount: '0.50' });
const response = await fetchWithPay('https://api.example.com/data');
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAmount` | string | `'0.10'` | Maximum payment per request (e.g., `'0.50'`) |
| `facilitator` | string | Megalith | Custom facilitator URL |

---

### x402Axios(axiosInstance, signer, options)

Wrap axios to automatically handle 402 Payment Required responses.

```javascript
const axios = require('axios');
const axiosWithPay = x402Axios(axios.create(), signer, { maxAmount: '0.50' });
const response = await axiosWithPay.get('https://api.example.com/data');
```

Same options as `x402Fetch`.

---

### x402Express(payTo, routes, options)

Express middleware to require payment for routes.

```javascript
app.use(x402Express('0xYourAddress', {
  '/api/premium': { price: '$0.01', network: 'base' },
  '/api/expensive': { price: '$1.00', network: 'base' }
}));
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `payTo` | string | Address to receive payments |
| `routes` | object | Route → config mapping |
| `options.facilitator` | string | Custom facilitator URL |

**Route config:**

| Field | Type | Description |
|-------|------|-------------|
| `price` | string | Price in dollars (e.g., `'$0.01'`) |
| `network` | string | Blockchain network |
| `asset` | string | Token address (default: USDC) |
| `description` | string | Human-readable description |

---

### x402Hono(payTo, routes, options)

Hono middleware to require payment for routes.

```javascript
const { Hono } = require('hono');
const app = new Hono();

app.use('*', x402Hono('0xYourAddress', {
  '/api/premium': { price: '$0.01', network: 'base' }
}));
```

Same parameters as `x402Express`.

---

### x402Next(handler, config, options)

Wrap Next.js API route handlers with payment requirement.

```javascript
// pages/api/premium.js
const { x402Next } = require('@megalithlabs/x402');

export default x402Next(
  async (req, res) => {
    res.json({ data: 'premium content' });
  },
  { payTo: '0xYourAddress', price: '$0.01', network: 'base' }
);
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

## How It Works

### Payer Flow

1. Your code calls `fetchWithPay('https://api.example.com/data')`
2. API returns `402 Payment Required` with payment requirements
3. SDK reads requirements, signs payment with your wallet
4. SDK retries request with `X-PAYMENT` header
5. API verifies payment, returns data

### Payee Flow

1. Request arrives at your Express/Hono/Next server
2. Middleware checks if route requires payment
3. No `X-PAYMENT` header? Return 402 with requirements
4. Has payment? Verify and settle via facilitator
5. Payment confirmed? Continue to your route handler

---

## CLI Tools

The SDK includes command-line tools for testing:

```bash
# Create payment authorization (interactive)
npm run signer

# Approve Stargate for ERC-20 tokens
npm run approve
```

See `tools/README.md` for details.

---

## Support

- Website: https://megalithlabs.ai
- x402 Protocol: https://x402.org
- Issues: https://github.com/MegalithLabs/x402/issues
- Email: support@megalithlabs.ai

---

## License

MIT License
