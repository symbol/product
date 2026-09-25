const serverAppConfig = {
	PUBLIC_BRIDGE_WRAPPED_URL: process.env.PUBLIC_BRIDGE_WRAPPED_URL || '',
	PUBLIC_BRIDGE_NATIVE_URL: process.env.PUBLIC_BRIDGE_NATIVE_URL || '',
	PUBLIC_REQUEST_TIMEOUT: Number(process.env.PUBLIC_REQUEST_TIMEOUT || 15000)
};

const isClientSide = 'undefined' !== typeof window;

export default isClientSide ? window.appConfig : serverAppConfig;
