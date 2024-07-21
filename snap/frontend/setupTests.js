// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

global.jest = jest;
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
	observe: () => null,
	unobserve: () => null,
	disconnect: () => null
}));


class IntersectionObserver {
	constructor(callback) {
		this.callback = callback;
	}

	observe() {}

	disconnect() {}

	unobserve() {}
};

/* eslint-disable jsx-a11y/alt-text, @next/next/no-img-element */
jest.mock('next/image', () => {
	const mockImage = ({...props}) => <img {...props} />;
	return mockImage;
});

jest.mock('@metamask/detect-provider', () => {
	const detectEthereumProvider = jest.fn();
	return detectEthereumProvider;
});

jest.mock('react-intersection-observer', () => {
	const useInView = {
		ref: jest.fn(),
		inView: jest.fn()
	};
	return useInView;
});
