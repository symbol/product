// Lib mocks
import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('i18n-js', () => jest.requireActual('i18n-js/dist/require/index'));

jest.mock('react-native-splash-screen', () => ({
	hide: jest.fn()
}));

jest.mock('bitcore-lib', () => ({
	...jest.requireActual('bitcore-lib')
}), { virtual: true });

// Local mocks
jest.mock('@/app/hooks', () => ({
	__esModule: true,  
	...jest.requireActual('@/app/hooks')
}));

beforeEach(() => {
	jest.clearAllMocks();
	jest.restoreAllMocks();
	// Note: Individual tests should call jest.useFakeTimers() if needed
});
