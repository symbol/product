export const setDevice = device => {
	window.matchMedia = query => ({
		matches: device === 'mobile' ? true : false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn()
	});
};
