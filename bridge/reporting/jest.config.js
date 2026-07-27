const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
	clearMocks: true,
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	coverageProvider: 'babel',
	modulePathIgnorePatterns: ['<rootDir>/.next/'],
	setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
	testEnvironment: 'jsdom'
});
