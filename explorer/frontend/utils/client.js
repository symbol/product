// Copies text string into clipboard.
// If browser's navigator API is unavailable, uses an "old" approach
export const copyToClipboard = async text => {
	if (navigator.clipboard) {
		return navigator.clipboard.writeText(text);
	}

	const textArea = document.createElement('textarea');
	let success = false;

	textArea.value = text;
	textArea.style.top = '0';
	textArea.style.left = '0';
	textArea.style.position = 'fixed';
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		success = document.execCommand('copy');
	} catch {}

	document.body.removeChild(textArea);

	if (!success) {
		throw Error('Failed to copy to clipboard');
	}
};

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
