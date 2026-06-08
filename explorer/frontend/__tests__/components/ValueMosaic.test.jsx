/* eslint-disable @next/next/no-img-element */
import ValueMosaic from '@/components/ValueMosaic';
import { render, screen } from '@testing-library/react';

jest.mock('@/config', () => ({
	__esModule: true,
	default: {
		NATIVE_MOSAIC_ID: '72C0212E67A08BCE',
		NATIVE_MOSAIC_TICKER: 'XYM',
		NATIVE_MOSAIC_ICON_SRC: '/symbol/images/icon-mosaic-native.svg',
		CUSTOM_MOSAIC_ICON_SRC: '/symbol/images/icon-mosaic-custom.svg'
	}
}));

jest.mock('next/link', () => {
	const MockLink = ({ href, children, className, title, onClick }) => (
		<a href={href} className={className} title={title} onClick={onClick}>{children}</a>
	);

	return {
		__esModule: true,
		default: MockLink
	};
});

jest.mock('@/components/CustomImage', () => {
	const MockCustomImage = ({ src, alt, className }) => <img src={src} alt={alt} className={className} />;

	return {
		__esModule: true,
		default: MockCustomImage
	};
});

describe('ValueMosaic', () => {
	it('renders the native mosaic icon from variant config', () => {
		// Act:
		render(<ValueMosaic isNative amount={12.345} />);

		// Assert:
		expect(screen.getByAltText('Mosaic')).toHaveAttribute('src', '/symbol/images/icon-mosaic-native.svg');
	});

	it('renders the custom mosaic icon from variant config', () => {
		// Act:
		render(<ValueMosaic mosaicId="85BBEA6CC462B244" mosaicName="custom.token" amount={1} />);

		// Assert:
		expect(screen.getByAltText('Mosaic')).toHaveAttribute('src', '/symbol/images/icon-mosaic-custom.svg');
	});
});
