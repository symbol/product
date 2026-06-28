export default {
	clearMocks: true,
	testMatch: ['<rootDir>/tests/**/*.test.js'],
	modulePaths: ['<rootDir>'],
	collectCoverageFrom: ['<rootDir>/src/**/*.js'],
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',
	coverageReporters: ['lcov'],
	coveragePathIgnorePatterns: [
		'<rootDir>/tests/',
		'<rootDir>/coverage/',
		'<rootDir>/src/types/'
	],
	transform: {} // Required for native ESM, even if empty
};
