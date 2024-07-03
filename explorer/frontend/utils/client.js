/**
 * Handles copying a text string to clipboard.
 * @param {string} text - text to copy
 * @returns {Promise<void>} throws an error if failed to copy
 */
export const copyToClipboard = async text => {
	if (navigator.clipboard) 
		return navigator.clipboard.writeText(text);

	// Fallback for browsers that do not support navigator.clipboard
	const textArea = document.createElement('textarea');
	textArea.value = text;
	textArea.style.top = '0';
	textArea.style.left = '0';
	textArea.style.position = 'fixed';
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	let isCopyExecuted = false;
	try {
		isCopyExecuted = document.execCommand('copy');
	} catch {}

	document.body.removeChild(textArea);

	if (!isCopyExecuted) 
		throw Error('Failed to copy to clipboard');
};

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

	if (parameter !== undefined && parameter !== null) 
		return `${route}/${parameter}`;

	return route;
};

/**
 * Handles navigation item click. Prevents navigation if disabled.
 * @param {Event} event - click event
 * @param {Function} onClick - click handler
 * @param {string} value - value to pass to click handler
 * @param {boolean} isNavigationDisabled - flag indicating if navigation is disabled
 * @returns {void} - nothing is returned
 */
export const handleNavigationItemClick = (event, onClick, value, isNavigationDisabled) => {
	event.stopPropagation();
	if (isNavigationDisabled) 
		event.preventDefault();
	if (onClick) 
		onClick(value);
};
