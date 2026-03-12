const transformIgnoreModules = [
	'@react-native',
	'react-native',
	'@react-navigation',
	'symbol-sdk',
	'symbol-crypto-wasm-web',
	'symbol-crypto-wasm-node',
	'react-native-reanimated',
	'react-native-worklets',
	'react-native-smooth-slider',
	'make-plural',
	'wallet-common-core',
	'wallet-common-symbol',
	'wallet-common-ethereum'
];

const assetFileExtensions = [
	'jpg',
	'jpeg',
	'png',
	'gif',
	'eot',
	'otf',
	'webp',
	'svg',
	'ttf',
	'woff',
	'woff2',
	'mp4',
	'webm',
	'wav',
	'mp3',
	'm4a',
	'aac',
	'oga',
	'css',
	'less'
];

module.exports = {
	// General settings
	preset: 'react-native',
	testMatch: ['<rootDir>/__tests__/**/*.test.js'],
	clearMocks: true,
	setupFilesAfterEnv: ['./setupTests.js'],
	setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
	maxWorkers: process.env.CI ? 2 : '50%',

	// Transform & module settings
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
	},
	transformIgnorePatterns: [`/node_modules/(?!(${transformIgnoreModules.join('|')})/)`],
	modulePaths: ['<rootDir>'],
	moduleNameMapper: {
		'^@/app/(.*)$': '<rootDir>/src/$1',
		'^__fixtures__/(.*)$': '<rootDir>/__fixtures__/$1',
		'^symbol-crypto-wasm-web': '<rootDir>node_modules/symbol-crypto-wasm-node/symbol_crypto_wasm.js',
		[`\\.(${assetFileExtensions.join('|')})$`]: '<rootDir>/jestAssetTransormer.js'
	},

	// Coverage settings
	collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',
	coveragePathIgnorePatterns: [
		'<rootDir>/setupTests.js',
		'<rootDir>/src/config',
		'<rootDir>/src/components/layout/Grid.jsx',
		'<rootDir>/__fixtures__/',
		'<rootDir>/__mocks__/',
		'<rootDir>/__tests__/',
		'<rootDir>/node_modules/',
		'<rootDir>/build/',
		'<rootDir>/coverage/',
		'<rootDir>/dist/'
	]
};
