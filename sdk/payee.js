// Megalith x402 - Payee Middleware
// Middleware to charge for API access via x402 payments
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Default facilitator
const DEFAULT_FACILITATOR = 'https://x402.megalithlabs.ai';

// Network RPC URLs for fetching token decimals
const NETWORK_RPC = {
  'base': 'https://mainnet.base.org/',
  'base-sepolia': 'https://sepolia.base.org/',
  'bsc': 'https://bsc-dataseed.binance.org/',
  'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545/'
};

// Token ABI for decimals
const TOKEN_ABI = ['function decimals() view returns (uint8)'];

// Cache for token decimals
const decimalsCache = {};

/**
 * Fetch token decimals from blockchain (with caching)
 * @private
 */
async function getTokenDecimals(asset, network) {
  const cacheKey = `${network}:${asset}`;
  if (decimalsCache[cacheKey] !== undefined) {
    return decimalsCache[cacheKey];
  }

  const rpcUrl = NETWORK_RPC[network];
  if (!rpcUrl) {
    throw new Error(`Unknown network: ${network}`);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const token = new ethers.Contract(asset, TOKEN_ABI, provider);

  try {
    const decimals = await token.decimals();
    decimalsCache[cacheKey] = Number(decimals);
    return decimalsCache[cacheKey];
  } catch (error) {
    throw new Error(`Failed to fetch decimals for token ${asset}: ${error.message}`);
  }
}

/**
 * Convert human-readable amount to atomic units
 * @private
 */
async function toAtomicUnits(amount, asset, network) {
  const decimals = await getTokenDecimals(asset, network);
  return ethers.parseUnits(amount.toString(), decimals).toString();
}

/**
 * Express middleware to require x402 payment for routes
 *
 * @param {string} payTo - Address to receive payments
 * @param {Object} routes - Route configuration { '/path': { amount: '0.01', asset: '0x...', network: 'base' } }
 * @param {Object} options - Options
 * @param {string} options.facilitator - Custom facilitator URL
 * @returns {Function} Express middleware
 *
 * @example
 * const app = express();
 * app.use(x402Express('0xYourAddress', {
 *   '/api/premium': {
 *     amount: '0.01',           // 0.01 tokens (human-readable)
 *     asset: '0x833589...',     // USDC on Base
 *     network: 'base'
 *   }
 * }));
 */
function x402Express(payTo, routes, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;
  const routePatterns = compileRoutes(routes);

  return async function middleware(req, res, next) {
    // Check if route requires payment
    const matchedRoute = findMatchingRoute(req.path, routePatterns);
    if (!matchedRoute) {
      return next();
    }

    const config = matchedRoute.config;

    // Check for payment header
    const paymentHeader = req.headers['x-payment'];
    if (!paymentHeader) {
      // Return 402 with payment requirements
      try {
        const requirements = await buildPaymentRequirements(payTo, config, req.path);
        return res.status(402).json({ paymentRequirements: requirements });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Verify and settle payment
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const result = await settlePayment(payment, config, facilitator);

      // Add payment response header
      res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(result)).toString('base64'));

      // Continue to route handler
      next();
    } catch (error) {
      try {
        const requirements = await buildPaymentRequirements(payTo, config, req.path);
        return res.status(402).json({
          error: error.message,
          paymentRequirements: requirements
        });
      } catch (reqError) {
        return res.status(500).json({ error: reqError.message });
      }
    }
  };
}

/**
 * Hono middleware to require x402 payment for routes
 *
 * @param {string} payTo - Address to receive payments
 * @param {Object} routes - Route configuration
 * @param {Object} options - Options
 * @returns {Function} Hono middleware
 *
 * @example
 * const app = new Hono();
 * app.use('*', x402Hono('0xYourAddress', {
 *   '/api/premium': { amount: '0.01', asset: '0x...', network: 'base' }
 * }));
 */
function x402Hono(payTo, routes, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;
  const routePatterns = compileRoutes(routes);

  return async function middleware(c, next) {
    // Check if route requires payment
    const matchedRoute = findMatchingRoute(c.req.path, routePatterns);
    if (!matchedRoute) {
      return await next();
    }

    const config = matchedRoute.config;

    // Check for payment header
    const paymentHeader = c.req.header('x-payment');
    if (!paymentHeader) {
      try {
        const requirements = await buildPaymentRequirements(payTo, config, c.req.path);
        return c.json({ paymentRequirements: requirements }, 402);
      } catch (error) {
        return c.json({ error: error.message }, 500);
      }
    }

    // Verify and settle payment
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const result = await settlePayment(payment, config, facilitator);

      c.header('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(result)).toString('base64'));

      await next();
    } catch (error) {
      try {
        const requirements = await buildPaymentRequirements(payTo, config, c.req.path);
        return c.json({
          error: error.message,
          paymentRequirements: requirements
        }, 402);
      } catch (reqError) {
        return c.json({ error: reqError.message }, 500);
      }
    }
  };
}

/**
 * Next.js middleware/wrapper to require x402 payment for API routes
 *
 * @param {Function} handler - Next.js API route handler
 * @param {Object} config - Payment configuration { payTo, amount, asset, network }
 * @param {Object} options - Options
 * @returns {Function} Wrapped handler
 *
 * @example
 * export default x402Next(
 *   async (req, res) => {
 *     res.json({ data: 'premium content' });
 *   },
 *   {
 *     payTo: '0xYourAddress',
 *     amount: '0.01',
 *     asset: '0x833589...',
 *     network: 'base'
 *   }
 * );
 */
function x402Next(handler, config, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;

  return async function wrappedHandler(req, res) {
    // Check for payment header
    const paymentHeader = req.headers['x-payment'];
    if (!paymentHeader) {
      try {
        const requirements = await buildPaymentRequirements(config.payTo, config, req.url);
        return res.status(402).json({ paymentRequirements: requirements });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Verify and settle payment
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const result = await settlePayment(payment, config, facilitator);

      res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(result)).toString('base64'));

      // Call original handler
      return await handler(req, res);
    } catch (error) {
      try {
        const requirements = await buildPaymentRequirements(config.payTo, config, req.url);
        return res.status(402).json({
          error: error.message,
          paymentRequirements: requirements
        });
      } catch (reqError) {
        return res.status(500).json({ error: reqError.message });
      }
    }
  };
}

/**
 * Build payment requirements object
 * @private
 */
async function buildPaymentRequirements(payTo, config, resource) {
  // Validate required fields
  if (!config.amount) {
    throw new Error('amount is required in route config');
  }
  if (!config.asset) {
    throw new Error('asset (token address) is required in route config');
  }
  if (!config.network) {
    throw new Error('network is required in route config');
  }

  // Convert human-readable amount to atomic units
  const maxAmountRequired = await toAtomicUnits(config.amount, config.asset, config.network);

  return {
    scheme: 'exact',
    network: config.network,
    maxAmountRequired,
    resource,
    description: config.description || `Payment of ${config.amount} tokens for ${resource}`,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: 30,
    asset: config.asset
  };
}

/**
 * Compile route patterns for matching
 * @private
 */
function compileRoutes(routes) {
  return Object.entries(routes).map(([pattern, config]) => ({
    pattern,
    regex: new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/:[^/]+/g, '[^/]+') + '$'),
    config
  }));
}

/**
 * Find matching route for a path
 * @private
 */
function findMatchingRoute(path, routePatterns) {
  for (const route of routePatterns) {
    if (route.regex.test(path)) {
      return route;
    }
  }
  return null;
}

/**
 * Settle payment with facilitator
 * @private
 */
async function settlePayment(payment, config, facilitator) {
  // Build full payload for facilitator
  const maxAmountRequired = await toAtomicUnits(config.amount, config.asset, config.network);

  const payload = {
    x402Version: 1,
    paymentPayload: payment,
    paymentRequirements: {
      scheme: 'exact',
      network: payment.network || config.network,
      maxAmountRequired,
      asset: config.asset
    }
  };

  const response = await fetch(`${facilitator}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Settlement failed: ${response.status}`);
  }

  return await response.json();
}

module.exports = {
  x402Express,
  x402Hono,
  x402Next,
  DEFAULT_FACILITATOR
};
