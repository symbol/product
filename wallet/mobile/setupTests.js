import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('rn-fetch-blob', () => {
    return {
        DocumentDir: () => {},
        polyfill: () => {},
    };
});
jest.mock('@haskkor/react-native-pincode', () => {
    return {
        hasUserSetPinCode: false,
    };
});
jest.mock('react-native-qrcode-scanner', () => {});
jest.mock('i18n-js', () => {
    return jest.requireActual('i18n-js/dist/require/index');
});
