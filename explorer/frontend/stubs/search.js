export const searchStub = async query => {
	if (query === 'nem' || query === 'nem.xem' || query === 'xem') {
		return { mosaic: { id: '6BED913FA20223F8', name: 'nem.xem' } };
	}
	if (query === 'supercoin' || query === 'namespace.supercoin') {
		return { mosaic: { id: '5AED903FB202130B', name: 'namespace.supercoin' } };
	}
	if (!isNaN(query)) {
		return { block: { height: +query } };
	}
	if (query.length === 40) {
		return { account: { address: query } };
	}
	if (query.length > 2 && query.length < 40) {
		return { account: { address: 'TAMP4SBUL2ND5K6GGNHTHGYOTHD3P4T4VKZGXSTC' } };
	}
	return null;
};
