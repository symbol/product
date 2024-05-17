// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

global.jest = jest;

/* eslint-disable jsx-a11y/alt-text, @next/next/no-img-element */
jest.mock('next/image', () => {
	const mockImage = ({...props}) => <img {...props} />;
	return mockImage;
});

jest.mock('@metamask/detect-provider', () => {
	const detectEthereumProvider = jest.fn();
	return detectEthereumProvider;
});
