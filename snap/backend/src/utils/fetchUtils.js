const fetchUtils = {
	async fetchData(url, method = 'GET', body = null) {
		const options = {
			method,
			headers: {
				'Content-Type': 'application/json'
			}
		};

		if (body)
			options.body = JSON.stringify(body);

		const response = await fetch(url, options);

		if (!response.ok)
			throw new Error(`Failed to fetch: ${response.statusText}`);

		return response.json();
	}
};

export default fetchUtils;
