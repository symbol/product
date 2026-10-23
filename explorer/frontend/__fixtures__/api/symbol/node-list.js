// Contract-based fixture; these values were not fetched from the live Nodewatch API.
export const nodeListResponse = [
	{
		balance: 82375.5549761234,
		endpoint: 'https://symbol.shizuilab.com:3001',
		finalizedEpoch: 3020,
		finalizedHash: 'E29E5695EB269B7DD1D76DBF05FDA1731AB24F561D2032248434FA36A27AFB4C',
		finalizedHeight: 1486740,
		finalizedPoint: 4,
		geoLocation: {
			city: 'Chiyoda',
			continent: 'Asia',
			country: 'Japan',
			lat: 12,
			lon: 15,
			region: '13',
			isp: 'Internet Inc.'
		},
		height: 1486760,
		isHealthy: true,
		isSslEnabled: true,
		mainPublicKey: '7dfb0d690bffa4a4979c7466c7b669ae8fbafd419daa10de948604cd9be65f0b',
		name: 'ibone74',
		nodePublicKey: 'd561824bd4e3053c39a8d5a4ab00583a4d99302c541f046d3a1e6ff023006d7c',
		restVersion: '2.4.4',
		roles: 3,
		version: '1.0.3.5'
	},
	{
		balance: 0,
		endpoint: '',
		finalizedEpoch: 0,
		finalizedHash: null,
		finalizedHeight: 0,
		finalizedPoint: 0,
		geoLocation: null,
		height: 0,
		isHealthy: null,
		isSslEnabled: null,
		mainPublicKey: 'A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21',
		name: 'Peer without endpoint',
		nodePublicKey: null,
		restVersion: null,
		roles: 1,
		version: '0.0.0.0'
	}
];

export const emptyNodeListResponse = [];
