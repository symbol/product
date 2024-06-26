/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

const nextJest = require('next/jest.js'); // eslint-disable-line import/extensions

const createJestConfig = nextJest({
	// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
	dir: './'
});

// Add any custom config to be passed to Jest
const customJestConfig = {
	workerThreads: true,
	testPathIgnorePatterns: ['/test-utils/'],
	coveragePathIgnorePatterns: ['/test-utils/'],
	clearMocks: true,
	coverageDirectory: 'coverage',
	coverageProvider: 'babel',
	moduleNameMapper: {
		'^@/api/(.*)$': '<rootDir>/api/$1',
		'^@/components/(.*)$': '<rootDir>/components/$1',
		'^@/config': '<rootDir>/config/index.js',
		'^@/constants': '<rootDir>/constants/index.js',
		'^@/pages/(.*)$': '<rootDir>/pages/$1',
		'^@/public/(.*)$': '<rootDir>/public/$1',
		'^@/styles/(.*)$': '<rootDir>/styles/$1',
		'^@/utils/(.*)$': '<rootDir>/utils/$1',
		'^@/utils': '<rootDir>/utils/index.js'
	},
	transform: {},
	resetMocks: true,
	restoreMocks: true,
	testEnvironment: 'jsdom',
	testTimeout: 2500,
	extensionsToTreatAsEsm: ['.jsx'],
	setupFilesAfterEnv: ['<rootDir>/setupTests.js']
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
