const appConfig = {
	PUBLIC_BRIDGE_WRAPPED_URL: 'https://bridge.example/wrapped',
	PUBLIC_BRIDGE_NATIVE_URL: 'https://bridge.example/native',
	PUBLIC_REQUEST_TIMEOUT: 5000
};

window.appConfig = appConfig;
Object.assign(process.env, appConfig);
