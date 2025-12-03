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

	async fetchRequests(mode, address, { pageSize, pageNumber } = {}) {
		const path = `/${mode}/requests/${address}`;
        
		return this.#makeBridgePageRequest(path, pageSize, pageNumber);
	}

	async fetchErrors(mode, address, { pageSize, pageNumber } = {}) {
		const path = `/${mode}/errors/${address}`;
        
		return this.#makeBridgePageRequest(path, pageSize, pageNumber);
	}

	async estimateRequest(mode, amount, recipientAddress) {
		return this.#makeBridgePostRequest(`/${mode}/prepare`, {
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

	#makeBridgePageRequest = async (path, pageSize = 15, pageNumber = 1) => {
		return this.#makeBridgeGetRequest(path, {
			count: pageSize,
			offset: (pageNumber - 1) * pageSize
		});
	};
}
