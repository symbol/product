// Stub helpers that keep shared pages rendering until the Symbol data layer exists.

/**
 * @typedef Page
 * @property {Array} data - the page data.
 * @property {number} pageNumber - the page number.
 */

export const emptyPage = () => Promise.resolve({ data: [], pageNumber: 1 });

export const resolveNull = () => Promise.resolve(null);

export const resolveEmptyList = () => Promise.resolve([]);

export const resolveEmptyObject = () => Promise.resolve({});

/**
 * Returns fixture rows on page 1 and an empty page afterwards so pagination terminates.
 * @param {Array} data - Fixture rows.
 * @returns {function(object): Promise<Page>} Page stub.
 */
export const stubPage = data => searchParams => {
	const pageNumber = searchParams?.pageNumber || 1;

	return Promise.resolve({ data: 1 < pageNumber ? [] : data, pageNumber });
};

/**
 * Returns a resolver that always resolves the same value.
 * @param {*} value - Value to resolve.
 * @returns {function(): Promise<*>} Resolver.
 */
export const stubValue = value => () => Promise.resolve(value);
