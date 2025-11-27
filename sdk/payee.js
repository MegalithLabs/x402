// Megalith x402 - Payee Middleware
// Middleware to charge for API access via x402 payments
// https://megalithlabs.ai

const { ethers } = require('ethers');

// Default facilitator
const DEFAULT_FACILITATOR = 'https://x402.megalithlabs.ai';

/**
 * Express middleware to require x402 payment for routes
 *
 * @param {string} payTo - Address to receive payments
 * @param {Object} routes - Route configuration { '/path': { price: '$0.01', network: 'base', asset: '0x...' } }
 * @param {Object} options - Options
 * @param {string} options.facilitator - Custom facilitator URL
 * @returns {Function} Express middleware
 *
 * @example
 * const app = express();
 * app.use(x402Express('0xYourAddress', {
 *   '/api/premium': { price: '$0.01', network: 'base' }
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
      return res.status(402).json({
        paymentRequirements: buildPaymentRequirements(payTo, config, req.path)
      });
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
      return res.status(402).json({
        error: error.message,
        paymentRequirements: buildPaymentRequirements(payTo, config, req.path)
      });
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
 *   '/api/premium': { price: '$0.01', network: 'base' }
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
      return c.json({
        paymentRequirements: buildPaymentRequirements(payTo, config, c.req.path)
      }, 402);
    }

    // Verify and settle payment
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const result = await settlePayment(payment, config, facilitator);

      c.header('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(result)).toString('base64'));

      await next();
    } catch (error) {
      return c.json({
        error: error.message,
        paymentRequirements: buildPaymentRequirements(payTo, config, c.req.path)
      }, 402);
    }
  };
}

/**
 * Next.js middleware/wrapper to require x402 payment for API routes
 *
 * @param {Function} handler - Next.js API route handler
 * @param {Object} config - Payment configuration { payTo, price, network, asset }
 * @param {Object} options - Options
 * @returns {Function} Wrapped handler
 *
 * @example
 * export default x402Next(
 *   async (req, res) => {
 *     res.json({ data: 'premium content' });
 *   },
 *   { payTo: '0xYourAddress', price: '$0.01', network: 'base' }
 * );
 */
function x402Next(handler, config, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;

  return async function wrappedHandler(req, res) {
    // Check for payment header
    const paymentHeader = req.headers['x-payment'];
    if (!paymentHeader) {
      return res.status(402).json({
        paymentRequirements: buildPaymentRequirements(config.payTo, config, req.url)
      });
    }

    // Verify and settle payment
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const result = await settlePayment(payment, config, facilitator);

      res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(result)).toString('base64'));

      // Call original handler
      return await handler(req, res);
    } catch (error) {
      return res.status(402).json({
        error: error.message,
        paymentRequirements: buildPaymentRequirements(config.payTo, config, req.url)
      });
    }
  };
}

/**
 * Build payment requirements object
 * @private
 */
function buildPaymentRequirements(payTo, config, resource) {
  // Parse price string like '$0.01' to atomic units
  const priceStr = config.price || '$0.01';
  const priceNum = parseFloat(priceStr.replace('$', ''));
  const decimals = config.decimals || 6; // USDC default
  const maxAmountRequired = Math.floor(priceNum * Math.pow(10, decimals)).toString();

  // Default to USDC on Base if not specified
  const network = config.network || 'base';
  const asset = config.asset || getDefaultAsset(network);

  return {
    scheme: 'exact',
    network,
    maxAmountRequired,
    resource,
    description: config.description || `Payment required for ${resource}`,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: 30,
    asset
  };
}

/**
 * Get default USDC address for network
 * @private
 */
function getDefaultAsset(network) {
  const assets = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
    'bsc': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BSC
    'bsc-testnet': '0x64544969ed7EBf5f083679233325356EbE738930' // Test USDC on BSC Testnet
  };
  return assets[network] || assets['base'];
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
  const payload = {
    x402Version: 1,
    paymentPayload: payment,
    paymentRequirements: {
      scheme: 'exact',
      network: payment.network || config.network,
      maxAmountRequired: config.maxAmountRequired || '0',
      asset: config.asset || getDefaultAsset(config.network)
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
