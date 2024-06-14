// Creates a page link by page name. Used in navigation.
export const createPageHref = (pageName, parameter) => {
	const routeNameMap = {
		home: '/',
		accounts: '/accounts',
		blocks: '/blocks',
		mosaics: '/mosaics',
		namespaces: '/namespaces',
		transactions: '/transactions'
	};
	const route = routeNameMap[pageName] || routeNameMap.home;

	if (parameter !== undefined && parameter !== null) {
		return `${route}/${parameter}`;
	}

	return route;
};
