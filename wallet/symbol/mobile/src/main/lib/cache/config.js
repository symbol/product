import { constants, createJrpcCacheEntry, createUrlCacheEntry } from 'wallet-common-core';

const { CacheMode, HttpMethod } = constants;

export const CacheScope = {
	SYMBOL_BLOCK: 'symbol:block',
	SYMBOL_STATIC: 'symbol:static',
	ETHEREUM_BLOCK: 'ethereum:block',
	ETHEREUM_STATIC: 'ethereum:static',
	MARKET: 'market'
};

export const CacheTtl = {
	SYMBOL_BLOCK: 30_000,
	ETHEREUM_BLOCK: 12_000,
	MINUTE: 60_000,
	TEN_MINUTES: 600_000,
	HOUR: 3_600_000
};

/**
 * Caching policy for read requests. Only listed requests are cached; anything not listed is at
 * most deduplicated (GET) or passed straight through (writes). Block-scoped entries are cleared
 * by chain events, static-scoped entries expire by TTL only.
 *
 * Deliberately not listed:
 * - "/transactionStatus/:hash" — polled during transaction announcement to await confirmation.
 * - "/node/info" and "/chain/info" — connection health probes; deduplicated only, so that node
 *   failure detection keeps reaching the network.
 * - all write requests — structurally uncacheable (only GET and listed POST requests can match).
 */
export const cacheEntries = [
	// Symbol REST: block-scoped data, changes with new blocks or account transactions.
	createUrlCacheEntry({
		path: '/accounts/:address',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/account/:address/multisig',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/network/fees/transaction',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/transactions/:group',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/namespaces',
		ttl: CacheTtl.MINUTE,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),

	// Symbol nodewatch: node info by public key, whose unlocked account list changes with new blocks.
	createUrlCacheEntry({
		path: '/api/symbol/nodes/nodePublicKey/:nodePublicKey',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/testnet/api/symbol/nodes/nodePublicKey/:nodePublicKey',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/api/symbol/nodes/mainPublicKey/:mainPublicKey',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),
	createUrlCacheEntry({
		path: '/testnet/api/symbol/nodes/mainPublicKey/:mainPublicKey',
		ttl: CacheTtl.SYMBOL_BLOCK,
		scopes: [CacheScope.SYMBOL_BLOCK]
	}),

	// Symbol REST: static and semi-static data, safe on TTL alone.
	createUrlCacheEntry({
		path: '/network/properties',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		path: '/network/fees/rental',
		ttl: CacheTtl.TEN_MINUTES,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		path: '/namespaces/:id',
		ttl: CacheTtl.TEN_MINUTES,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		path: '/statements/resolutions/address',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		httpMethod: HttpMethod.POST,
		path: '/namespaces/names',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		httpMethod: HttpMethod.POST,
		path: '/namespaces/mosaic/names',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	createUrlCacheEntry({
		httpMethod: HttpMethod.POST,
		path: '/mosaics',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),
	// Transaction details by ids — immutable once the transactions are confirmed.
	createUrlCacheEntry({
		httpMethod: HttpMethod.POST,
		path: '/transactions/:group',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.SYMBOL_STATIC]
	}),

	// Connection health probes: collapse concurrent bursts, but every settled probe hits the network.
	createUrlCacheEntry({
		path: '/node/info',
		mode: CacheMode.DEDUP
	}),
	createUrlCacheEntry({
		path: '/chain/info',
		mode: CacheMode.DEDUP
	}),

	// Ethereum JSON-RPC.
	createJrpcCacheEntry({
		rpcMethod: 'eth_chainId',
		ttl: CacheTtl.HOUR,
		scopes: [CacheScope.ETHEREUM_STATIC]
	}),
	createJrpcCacheEntry({
		rpcMethod: 'eth_feeHistory',
		ttl: CacheTtl.ETHEREUM_BLOCK,
		scopes: [CacheScope.ETHEREUM_BLOCK]
	}),
	createJrpcCacheEntry({
		rpcMethod: 'eth_blockNumber',
		mode: CacheMode.DEDUP
	}),

	// Market prices; the market module keeps its own 60-second guard, this covers direct api calls.
	createUrlCacheEntry({
		path: '/api/v3/simple/price',
		ttl: CacheTtl.MINUTE,
		scopes: [CacheScope.MARKET]
	})
];
