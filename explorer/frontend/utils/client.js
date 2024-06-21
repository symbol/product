/**
 * Creates a page link by page name. Used in navigation.
 * @param {string} pageName - page name
 * @param {string} parameter - parameter
 * @returns {string} page link
 */
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

/**
 * Handles navigation item click. Prevents navigation if disabled.
 * @param {Event} event - click event
 * @param {Function} onClick - click handler
 * @param {string} value - value to pass to click handler
 * @param {boolean} isNavigationDisabled - flag indicating if navigation is disabled
 */
export const handleNavigationItemClick = (event, onClick, value, isNavigationDisabled) => {
	event.stopPropagation();
	if (!onClick) return;
	if (isNavigationDisabled) event.preventDefault();
	onClick(value);
};
