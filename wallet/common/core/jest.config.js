export default {
	clearMocks: true,
	testMatch: ['<rootDir>/tests/**/*.test.js'],
	modulePaths: ['<rootDir>'],
	collectCoverageFrom: ['src/**/*.{js}'],
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',
	coveragePathIgnorePatterns: [
		'<rootDir>/tests/',
		'<rootDir>/coverage/'
	],
	transform: {} // Required for native ESM, even if empty
};
