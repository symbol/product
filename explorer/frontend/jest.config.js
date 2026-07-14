// Pin the shared suite to the reference variant before next/jest loads deployment .env files.
process.env.NEXT_PUBLIC_EXPLORER_VARIANT = process.env.JEST_EXPLORER_VARIANT || 'nem';

const fs = require('fs');
const path = require('path');
const nextJest = require('next/jest.js'); // eslint-disable-line import/extensions

// Map aliases from jsconfig.json to Jest moduleNameMapper
const mapPathsToModuleNameMapper = () => {
	const jsConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'jsconfig.json'), 'utf8'));
	const paths = jsConfig.compilerOptions.paths || {};

	const moduleNameMapper = Object.entries(paths).reduce((acc, [key, value]) => {
		const formattedKey = `^${key.replace(/\*/g, '(.*)')}$`;
		const formattedValue = path.join('<rootDir>', value[0].replace(/\*/g, '$1'));
		acc[formattedKey] = formattedValue;

		return acc;
	}, {});

	return moduleNameMapper;
};

const moduleNameMapper = mapPathsToModuleNameMapper();

// Mirror next.config.js so tests load the same active-variant modules as the build.
moduleNameMapper['^@/app/active-variant/(.*)$'] = `<rootDir>/variants/${process.env.NEXT_PUBLIC_EXPLORER_VARIANT}/$1`;

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
	coverageProvider: 'babel',
	moduleNameMapper,
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
