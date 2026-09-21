const appConfig = {
	PUBLIC_BRIDGE_WRAPPED_URL: 'https://bridge.example/wrapped',
	PUBLIC_BRIDGE_NATIVE_URL: 'https://bridge.example/native',
	PUBLIC_REQUEST_TIMEOUT: 5000
};

window.appConfig = appConfig;
Object.assign(process.env, appConfig);

global.IntersectionObserver = jest.fn(callback => {
	const observer = {
		callback,
		disconnect: jest.fn(),
		observe: jest.fn(),
		unobserve: jest.fn()
	};
	global.intersectionObserverInstances.push(observer);
	return observer;
});

beforeEach(() => {
	global.intersectionObserverInstances = [];
});
