// Megalith x402 - Payee Middleware
// Middleware to charge for API access via x402 payments
// https://megalithlabs.ai

const { ethers } = require('ethers');
const {
  createDebugLogger,
  DEFAULT_FACILITATOR,
  FACILITATOR_TIMEOUT_MS,
  NETWORKS,
  base64Encode,
  parsePaymentHeader,
  TOKEN_ABI_ETHERS
} = require('./utils');

const debug = createDebugLogger('payee');

// Cache for token decimals
const decimalsCache = {};

// Cache for token metadata (name, version)
const tokenMetadataCache = {};

/**
 * Fetch token metadata (name, version) from blockchain (with caching)
 * Required for EIP-712 domain in the extra field
 * @private
 */
async function getTokenMetadata(asset, network) {
  const cacheKey = `${network}:${asset}`;
  if (tokenMetadataCache[cacheKey] !== undefined) {
    return tokenMetadataCache[cacheKey];
  }

  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}. Supported: ${Object.keys(NETWORKS).join(', ')}`);
  }

  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const token = new ethers.Contract(asset, TOKEN_ABI_ETHERS, provider);

  try {
    // Fetch name and version in parallel
    const [name, version] = await Promise.all([
      token.name().catch(() => 'Unknown Token'),
      token.version().catch(() => '1') // Default to '1' if not implemented
    ]);

    tokenMetadataCache[cacheKey] = { name, version };
    return tokenMetadataCache[cacheKey];
  } catch (error) {
    // Fallback if both fail
    tokenMetadataCache[cacheKey] = { name: 'Unknown Token', version: '1' };
    return tokenMetadataCache[cacheKey];
  }
}

/**
 * Fetch token decimals from blockchain (with caching)
 * @private
 */
async function getTokenDecimals(asset, network) {
  const cacheKey = `${network}:${asset}`;
  if (decimalsCache[cacheKey] !== undefined) {
    return decimalsCache[cacheKey];
  }

  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}. Supported: ${Object.keys(NETWORKS).join(', ')}`);
  }

  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const token = new ethers.Contract(asset, TOKEN_ABI_ETHERS, provider);

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

    debug('Express: Payment required for %s', req.path);
    const config = matchedRoute.config;

    // Check for payment header
    const paymentHeader = req.headers['x-payment'];
    if (!paymentHeader) {
      debug('Express: No X-PAYMENT header, returning 402');
      // Return 402 with payment requirements (x402-compliant format)
      try {
        const x402Response = await buildPaymentRequirements(payTo, config, req.path);
        return res.status(402).json(x402Response);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Parse and validate payment header
    const { payment, error: parseError } = parsePaymentHeader(paymentHeader);
    if (parseError) {
      debug('Express: Invalid payment header: %s', parseError);
      return res.status(400).json({ error: parseError });
    }

    debug('Express: Payment header validated, settling with facilitator');

    // Verify and settle payment
    try {
      const result = await settlePayment(payment, config, facilitator);
      debug('Express: Settlement successful, txHash: %s', result.transactionHash || 'N/A');

      // Add payment response header
      res.setHeader('X-PAYMENT-RESPONSE', base64Encode(JSON.stringify(result)));

      // Continue to route handler
      next();
    } catch (error) {
      debug('Express: Settlement failed: %s', error.message);
      try {
        const x402Response = await buildPaymentRequirements(payTo, config, req.path);
        x402Response.error = error.message;
        return res.status(402).json(x402Response);
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

    debug('Hono: Payment required for %s', c.req.path);
    const config = matchedRoute.config;

    // Check for payment header
    const paymentHeader = c.req.header('x-payment');
    if (!paymentHeader) {
      debug('Hono: No X-PAYMENT header, returning 402');
      try {
        const x402Response = await buildPaymentRequirements(payTo, config, c.req.path);
        return c.json(x402Response, 402);
      } catch (error) {
        return c.json({ error: error.message }, 500);
      }
    }

    // Parse and validate payment header
    const { payment, error: parseError } = parsePaymentHeader(paymentHeader);
    if (parseError) {
      debug('Hono: Invalid payment header: %s', parseError);
      return c.json({ error: parseError }, 400);
    }

    debug('Hono: Payment header validated, settling with facilitator');

    // Verify and settle payment
    try {
      const result = await settlePayment(payment, config, facilitator);
      debug('Hono: Settlement successful');

      c.header('X-PAYMENT-RESPONSE', base64Encode(JSON.stringify(result)));

      await next();
    } catch (error) {
      debug('Hono: Settlement failed: %s', error.message);
      try {
        const x402Response = await buildPaymentRequirements(payTo, config, c.req.path);
        x402Response.error = error.message;
        return c.json(x402Response, 402);
      } catch (reqError) {
        return c.json({ error: reqError.message }, 500);
      }
    }
  };
}

/**
 * Next.js wrapper to require x402 payment for API routes
 * Supports both App Router (Next.js 13+) and Pages Router
 *
 * @param {Function} handler - Next.js API route handler
 * @param {Object} config - Payment configuration { payTo, amount, asset, network }
 * @param {Object} options - Options
 * @returns {Function} Wrapped handler
 *
 * @example App Router (Next.js 13+)
 * // app/api/premium/route.js
 * import { x402Next } from '@megalithlabs/x402';
 *
 * async function handler(req) {
 *   return Response.json({ data: 'premium content' });
 * }
 *
 * export const GET = x402Next(handler, {
 *   payTo: '0xYourAddress',
 *   amount: '0.01',
 *   asset: '0x833589...',
 *   network: 'base'
 * });
 *
 * @example Pages Router (legacy)
 * // pages/api/premium.js
 * export default x402Next(
 *   async (req, res) => {
 *     res.json({ data: 'premium content' });
 *   },
 *   { payTo: '0x...', amount: '0.01', asset: '0x...', network: 'base' }
 * );
 */
function x402Next(handler, config, options = {}) {
  const facilitator = options.facilitator || DEFAULT_FACILITATOR;

  return async function wrappedHandler(req, resOrContext) {
    // Detect if App Router (req is Request object) or Pages Router (req has headers object)
    const isAppRouter = req instanceof Request || (req.constructor && req.constructor.name === 'Request');

    if (isAppRouter) {
      return handleAppRouter(req, handler, config, facilitator);
    } else {
      return handlePagesRouter(req, resOrContext, handler, config, facilitator);
    }
  };
}

/**
 * Handle App Router (Next.js 13+) requests
 * @private
 */
async function handleAppRouter(req, handler, config, facilitator) {
  const paymentHeader = req.headers.get('x-payment');

  if (!paymentHeader) {
    try {
      const url = new URL(req.url);
      const x402Response = await buildPaymentRequirements(config.payTo, config, url.pathname);
      return Response.json(x402Response, { status: 402 });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // Parse and validate payment header
  const { payment, error: parseError } = parsePaymentHeader(paymentHeader);
  if (parseError) {
    return Response.json({ error: parseError }, { status: 400 });
  }

  try {
    const result = await settlePayment(payment, config, facilitator);

    // Call original handler and add payment response header
    const response = await handler(req);

    // Clone response to add header
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-PAYMENT-RESPONSE', base64Encode(JSON.stringify(result)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    try {
      const url = new URL(req.url);
      const x402Response = await buildPaymentRequirements(config.payTo, config, url.pathname);
      x402Response.error = error.message;
      return Response.json(x402Response, { status: 402 });
    } catch (reqError) {
      return Response.json({ error: reqError.message }, { status: 500 });
    }
  }
}

/**
 * Handle Pages Router (legacy) requests
 * @private
 */
async function handlePagesRouter(req, res, handler, config, facilitator) {
  const paymentHeader = req.headers['x-payment'];

  if (!paymentHeader) {
    try {
      const x402Response = await buildPaymentRequirements(config.payTo, config, req.url);
      return res.status(402).json(x402Response);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Parse and validate payment header
  const { payment, error: parseError } = parsePaymentHeader(paymentHeader);
  if (parseError) {
    return res.status(400).json({ error: parseError });
  }

  try {
    const result = await settlePayment(payment, config, facilitator);

    res.setHeader('X-PAYMENT-RESPONSE', base64Encode(JSON.stringify(result)));

    return await handler(req, res);
  } catch (error) {
    try {
      const x402Response = await buildPaymentRequirements(config.payTo, config, req.url);
      x402Response.error = error.message;
      return res.status(402).json(x402Response);
    } catch (reqError) {
      return res.status(500).json({ error: reqError.message });
    }
  }
}

/**
 * Build payment requirements object
 * Returns the full x402-compliant response with accepts array
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

  // Fetch token decimals and metadata in parallel
  const [maxAmountRequired, tokenMetadata] = await Promise.all([
    toAtomicUnits(config.amount, config.asset, config.network),
    getTokenMetadata(config.asset, config.network)
  ]);

  // Build the payment requirement object (goes in accepts array)
  const requirement = {
    scheme: 'exact',
    network: config.network,
    maxAmountRequired,
    resource,
    description: config.description || `Payment of ${config.amount} tokens for ${resource}`,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: config.maxTimeoutSeconds || 30,
    asset: config.asset,
    // Extra field contains token metadata for EIP-712 domain
    extra: {
      name: tokenMetadata.name,
      version: tokenMetadata.version
    }
  };

  // Return full x402-compliant response structure
  return {
    x402Version: 1,
    accepts: [requirement]
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
async function settlePayment(payment, config, facilitator, timeoutMs = FACILITATOR_TIMEOUT_MS) {
  debug('Settling payment with facilitator: %s', facilitator);

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

  debug('Settlement payload: network=%s, asset=%s, amount=%s',
    payload.paymentRequirements.network,
    payload.paymentRequirements.asset,
    payload.paymentRequirements.maxAmountRequired
  );

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${facilitator}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      debug('Settlement failed: %s', error.error || response.status);
      throw new Error(error.error || `Settlement failed: ${response.status}`);
    }

    const result = await response.json();
    debug('Settlement response: %O', result);
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      debug('Settlement timed out after %dms', timeoutMs);
      throw new Error(`Facilitator request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  x402Express,
  x402Hono,
  x402Next,
  DEFAULT_FACILITATOR
};
