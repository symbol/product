export class BridgeApi {
	/**
     * @param {object} options
     * @param {object} options.bridgeUrls
     * @param {Function} options.makeRequest
     * @param {string} options.networkIdentifier
     */
	constructor({ bridgeUrls, makeRequest, networkIdentifier }) {
		this.bridgeUrls = bridgeUrls;
		this.makeRequest = makeRequest;
		this.networkIdentifier = networkIdentifier;
	}

	setNetworkIdentifier(networkIdentifier) {
		this.networkIdentifier = networkIdentifier;
	}

	async fetchConfig() {
		return this.#makeBridgeGetRequest('/');
	}

	async fetchRequests(mode, address, { pageSize, cursor } = {}) {
		const path = `/${mode}/requests/${address}`;
        
		return this.#makeBridgePageRequest(path, pageSize, cursor);
	}

	async fetchErrors(mode, address, { pageSize, cursor } = {}) {
		const path = `/${mode}/errors/${address}`;
        
		return this.#makeBridgePageRequest(path, pageSize, cursor);
	}

	async estimateRequest(mode, amount, recipientAddress) {
		return this.#makeBridgePostRequest(`/${mode}/estimate`, {
			amount,
			recipientAddress
		});
	}

	#makeBridgePostRequest = async (path, body) => {
		const url = this.bridgeUrls[this.networkIdentifier] + path;
		return this.makeRequest(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	};

	#makeBridgeGetRequest = async (path, query) => {
		let url = this.bridgeUrls[this.networkIdentifier] + path;
        
		if (query) {
			url += '?';
			Object.entries(query).forEach(([key, value]) => {
				url += `${key}=${value}&`;
			});
			url = url.slice(0, -1);
		}
        
		return this.makeRequest(url);
	};

	#makeBridgePageRequest = async (path, pageSize = 15, cursor = null) => {
		const firstPageNumber = 1;
		const pageNumber = cursor === null ? firstPageNumber : Number(cursor);
		const data = await this.#makeBridgeGetRequest(path, {
			count: pageSize,
			offset: (pageNumber - 1) * pageSize
		});
		const isNextPageAvailable = data.length >= pageSize;

		return { data, nextCursor: isNextPageAvailable ? String(pageNumber + 1) : null };
	};
}
