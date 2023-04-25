export const loadHome = async target => {
	switch (target) {
	case 'nem':
		const NEMHome = await import('./nem/pages/Home');
		return NEMHome.default;
	case 'symbol':
		const SymbolHome = await import('./symbol/pages/Home');
		return SymbolHome.default;
	default:
		throw Error('The build target is not specified');
	}
};
