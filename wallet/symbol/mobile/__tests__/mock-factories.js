/**
 * Creates the `@/app/utils` account display-data overrides backed by a fixed address-to-info map.
 * Spread the result into a `jest.mock('@/app/utils', ...)` factory alongside `jest.requireActual`,
 * so name resolution becomes deterministic while every other util stays real.
 * @param {{[address: string]: { name: string|null, imageId: string|null }}} accountInfoMap - The known info per address.
 * @returns {object} The `getAccountKnownInfo` and `createAccountDisplayData` overrides.
 */
export const createAccountDisplayDataUtilsMock = accountInfoMap => {
	const getAccountKnownInfo = address => accountInfoMap[address] ?? { name: null, imageId: null };

	return {
		getAccountKnownInfo,
		createAccountDisplayData: address => {
			const knownInfo = getAccountKnownInfo(address);

			return { address, name: knownInfo.name, imageId: knownInfo.imageId, color: '#000000' };
		}
	};
};

/**
 * Creates mock for the known-tokens config `@/app/config`. 
 * The result must be spread into `jest.mock('@/app/config', ...)`.
 * @param {{[tokenId: string]: { name: string, ticker: string|null, imageId: string|null }}} tokenInfoMap - Known info per token id.
 * @param {string} [chainName='symbol'] - Chain name where the tokens belong to.
 * @param {string} [networkIdentifier='testnet'] - Network id the tokens belong to.
 * @returns {object} The `knownTokens` override config.
 */
export const createKnownTokensConfigMock = (tokenInfoMap, chainName = 'symbol', networkIdentifier = 'testnet') => {
	const { knownTokens } = jest.requireActual('@/app/config');
	const entries = Object.entries(tokenInfoMap).map(([tokenId, info]) => ({ tokenId, ...info }));

	return {
		knownTokens: {
			...knownTokens,
			[chainName]: {
				...knownTokens[chainName],
				[networkIdentifier]: entries
			}
		}
	};
};

/**
 * Creates mock for a paged fetch function. Pass the result to `jest.fn(...)`.
 * The mock reads the cursor from its last argument and returns the next cursor until the pages run out.
 * @param {{[pageNumber: number]: object[]}} pages - Items per page number, starting from 1.
 * @returns {function(...*): Promise<{ data: object[], nextCursor: string|null }>} The fetch function.
 */
export const createPagedFetchMock = pages => async (...args) => {
	const searchCriteria = args.at(-1);
	const { cursor } = searchCriteria;
	const pageNumber = cursor === null ? 1 : Number(cursor);
	const nextPageNumber = pageNumber + 1;
	const isNextPageAvailable = pages[nextPageNumber] !== undefined;

	return {
		data: pages[pageNumber] ?? [],
		nextCursor: isNextPageAvailable ? String(nextPageNumber) : null
	};
};
