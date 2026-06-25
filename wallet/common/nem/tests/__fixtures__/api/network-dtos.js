// Real NEM node response shapes from the NIS API documentation. Each fixture keeps only the fields the
// NetworkService consumes.

// /node/info — NIS serializes metaData.networkId as a signed byte (testnet 0x98 → -104); it is normalized
// back to the unsigned network type (152) before mapping to a network identifier.
export const nodeInfoResponse = { metaData: { networkId: -104 } };

// /chain/height
export const chainHeightResponse = { height: '4368990' };

// /time-sync/network-time — sendTimeStamp is NEM network time in milliseconds since the NEM epoch.
export const networkTimeResponse = { sendTimeStamp: 254452058000 };

// Nodewatch peer list — each node exposes its endpoint URL.
export const nodeListResponse = [
	{ endpoint: 'http://node1:7890' },
	{ endpoint: 'http://node2:7890' }
];
