# MegalithStargate Contract Management

This directory contains the MegalithStargate smart contract and management scripts.

## Contract Address

**Deployed via CREATE2 (same address on all networks):**
```
0x40200001004B5110333e4De8179426971Efd034A
```

## Supported Networks

| Network | Chain ID | Explorer |
|---------|----------|----------|
| Base Mainnet | 8453 | https://basescan.org |
| Base Sepolia | 84532 | https://sepolia.basescan.org |
| BNB Chain Mainnet | 56 | https://bscscan.com |
| BNB Chain Testnet | 97 | https://testnet.bscscan.com |

---

## Adding a Facilitator

Facilitators are whitelisted addresses that can call `settleERC20()` to process payments.

### Using the Script (Recommended)

1. **Install dependencies:**
   ```bash
   cd ../Signer
   npm install
   ```

2. **Configure:**
   ```bash
   cd ../Contracts
   cp .env.example .env
   # Edit .env with your values:
   #   NETWORK=base
   #   FACILITATOR_ADDRESS=0x...
   #   OWNER_KEY=0x...
   ```

3. **Run:**
   ```bash
   node add-facilitator.js
   ```

### Using Basescan Directly

If the contract is verified on Basescan:

1. Go to: `https://basescan.org/address/0x40200001004B5110333e4De8179426971Efd034A#writeContract`
2. Click "Connect to Web3"
3. Find `addFacilitator` function
4. Enter facilitator address
5. Click "Write"

### Using Basescan Without Verification

If the contract is NOT verified:

1. Go to: `https://basescan.org/address/0x40200001004B5110333e4De8179426971Efd034A#writeContract`
2. Click "Write as Proxy" or use the script above instead

**Alternative: Use Cast (Foundry)**

```bash
cast send 0x40200001004B5110333e4De8179426971Efd034A \
  "addFacilitator(address)" \
  0xFACILITATOR_ADDRESS_HERE \
  --private-key $OWNER_KEY \
  --rpc-url https://mainnet.base.org
```

---

## Verifying the Contract on Basescan

### Method 1: Standard Verification (If Working)

1. Go to Basescan contract page
2. Click "Contract" → "Verify and Publish"
3. Enter:
   - Compiler Version: `v0.8.20+commit.a1b79de6`
   - License: `MIT`
   - Optimization: `Yes` with 200 runs
4. Paste contract code
5. Submit

### Method 2: Flattened Contract (If Method 1 Fails)

The "Unable to connect to remote server" error means Basescan can't fetch OpenZeppelin imports.

**Solution: Flatten the contract first**

#### Using Hardhat Flatten:

```bash
npm install --save-dev hardhat
npx hardhat flatten Stargate.sol > Stargate-flattened.sol
```

Then verify using the flattened file.

#### Using Foundry Flatten:

```bash
forge flatten Stargate.sol > Stargate-flattened.sol
```

#### Manual Flattening:

You'll need to copy all imported files into one file:
1. OpenZeppelin's SafeERC20.sol
2. OpenZeppelin's IERC20.sol
3. OpenZeppelin's ReentrancyGuard.sol
4. OpenZeppelin's Pausable.sol
5. OpenZeppelin's Ownable2Step.sol
6. OpenZeppelin's ECDSA.sol

Then paste on Basescan with:
- Compiler: `v0.8.20+commit.a1b79de6`
- Optimization: Enabled with 200 runs
- License: MIT

### Method 3: Via Hardhat Verify

Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.OWNER_KEY]
    }
  },
  etherscan: {
    apiKey: {
      base: "YOUR_BASESCAN_API_KEY"
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  }
};
```

Then run:
```bash
npx hardhat verify --network base 0x40200001004B5110333e4De8179426971Efd034A
```

### Method 4: Via Foundry

```bash
forge verify-contract \
  0x40200001004B5110333e4De8179426971Efd034A \
  Stargate.sol:MegalithStargate \
  --chain-id 8453 \
  --etherscan-api-key YOUR_BASESCAN_API_KEY \
  --compiler-version v0.8.20+commit.a1b79de6 \
  --num-of-optimizations 200
```

---

## Troubleshooting

### "Unable to connect to remote server" on Basescan

**Cause:** Basescan cannot fetch OpenZeppelin imports from GitHub.

**Solutions:**
1. Wait and try again (Basescan might be having issues)
2. Use flattened contract (Method 2 above)
3. Use Hardhat or Foundry CLI verification (Methods 3-4)
4. Try during off-peak hours

### "You are not the contract owner"

**Cause:** The private key you're using doesn't match the contract owner.

**Solution:** Verify the owner address:
```bash
cast call 0x40200001004B5110333e4De8179426971Efd034A "owner()(address)" --rpc-url https://mainnet.base.org
```

### Facilitator Already Added

The script will detect if the address is already a facilitator and skip the transaction.

---

## Contract Functions

### Owner Functions

- `addFacilitator(address)` - Whitelist a facilitator
- `removeFacilitator(address)` - Remove a facilitator
- `proposeFeeChange(uint256)` - Propose new fee (24h timelock)
- `executeFeeChange()` - Execute pending fee change
- `withdrawFees(address, address)` - Withdraw collected fees
- `pause()` - Emergency pause
- `unpause()` - Resume operations

### Facilitator Functions

- `settleERC20(...)` - Settle an ERC-20 payment

### View Functions

- `owner()` - Get contract owner address
- `facilitators(address)` - Check if address is facilitator
- `isFacilitator(address)` - Same as above
- `getNonce(address, address)` - Get user's nonce for a token
- `feePercentage()` - Current fee in basis points
- `collectedFees(address)` - Fees collected for a token

---

## Security

- Contract is `Ownable2Step` - requires 2-step ownership transfer
- Has 24-hour timelock on fee changes
- Max fee capped at 5%
- Pausable for emergencies
- ReentrancyGuard on settlement functions
- EIP-712 signature verification
- Nonce-based replay protection

---

## Support

- Documentation: https://github.com/MegalithLabs/x402
- Protocol: https://x402.org
- Email: support@megalithlabs.ai
