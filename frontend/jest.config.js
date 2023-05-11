import nextJest from 'next/jest.js'; // eslint-disable-line import/extensions

const createJestConfig = nextJest({
	// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
	dir: './'
});

// Add any custom config to be passed to Jest
const customJestConfig = {
	setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
	testEnvironment: 'jest-environment-jsdom',
	transform: {},
	extensionsToTreatAsEsm: ['.jsx']
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);
