const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
	clearMocks: true,
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	modulePathIgnorePatterns: ['<rootDir>/.next/'],
	testEnvironment: 'jsdom'
});
