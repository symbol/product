/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';

let mockPathname = '/blocks';
let mockUseStorage = jest.fn((key, initialValue) => [initialValue, jest.fn()]);
let mockUseToggle = jest.fn(initialValue => [initialValue, jest.fn()]);

jest.mock('@/config', () => ({
	__esModule: true,
	default: {
		HEADER_LOGO_SRC: '/symbol/images/logo-symbol.png',
		HEADER_LOGO_ALT: 'Symbol',
		HEADER_LOGO_WIDTH: '10rem',
		HEADER_LOGO_HEIGHT: '2.56rem',
		FOOTER_LOGO_SRC: '/symbol/images/logo-symbol.png',
		FOOTER_LOGO_ALT: 'Symbol',
		SOCIAL_URL_GITHUB: 'https://github.com/symbol',
		SOCIAL_URL_DISCORD: 'https://discord.example',
		SOCIAL_URL_TWITTER: 'https://twitter.example',
		FOOTER_URL_TECHNICAL_REFERENCE: 'https://docs.example/tech',
		FOOTER_URL_DOCS: 'https://docs.example',
		FOOTER_URL_FAUCET: 'https://faucet.example',
		FOOTER_URL_SUPERNODE_PROGRAM: 'https://supernode.example'
	}
}));

jest.mock('next/image', () => {
	const MockImage = ({ src, alt, fill }) => <img src={src} alt={alt} data-fill={fill ? 'true' : 'false'} />;

	return {
		__esModule: true,
		default: MockImage
	};
});

jest.mock('next/link', () => {
	const MockLink = ({ children, href, className }) => <a href={href} className={className}>{children}</a>;

	return {
		__esModule: true,
		default: MockLink
	};
});

jest.mock('next/router', () => ({
	useRouter: () => ({
		asPath: '/blocks',
		locale: 'en',
		push: jest.fn()
	})
}));

jest.mock('next/navigation', () => ({
	usePathname: () => mockPathname
}));

jest.mock('next-i18next', () => ({
	useTranslation: () => ({ t: key => key })
}));

jest.mock('react-toastify', () => ({
	toast: {
		error: jest.fn()
	}
}));

jest.mock('@/api/search', () => ({
	search: jest.fn()
}));

jest.mock('@/utils', () => ({
	createPageHref: pageName => ({
		home: '/',
		blocks: '/blocks',
		accounts: '/accounts',
		transactions: '/transactions',
		mosaics: '/mosaics',
		namespaces: '/namespaces',
		nodes: '/nodes'
	}[pageName]),
	formatDate: () => 'formatted date',
	useStorage: (key, initialValue) => mockUseStorage(key, initialValue),
	useToggle: initialValue => mockUseToggle(initialValue)
}));

jest.mock('@/components/CustomImage', () => {
	const MockCustomImage = ({ src, alt, className, onClick }) => <img src={src} alt={alt} className={className} onClick={onClick} />;

	return {
		__esModule: true,
		default: MockCustomImage
	};
});

jest.mock('@/components/Dropdown', () => ({
	Dropdown: ({ value, onChange }) => <select aria-label="dropdown" value={value} onChange={event => onChange(event.target.value)} />
}));

jest.mock('@/components/Field', () => {
	const MockField = ({ title, children }) => <div><span>{title}</span>{children}</div>;

	return {
		__esModule: true,
		default: MockField
	};
});

jest.mock('@/components/Modal', () => {
	const MockModal = ({ children, isVisible }) => (isVisible ? <div>{children}</div> : null);

	return {
		__esModule: true,
		default: MockModal
	};
});

jest.mock('@/components/SearchBar', () => {
	const MockSearchBar = () => <div data-testid="search-bar" />;

	return {
		__esModule: true,
		default: MockSearchBar
	};
});

jest.mock('@/components/TextBox', () => {
	const MockTextBox = props => <input {...props} />;

	return {
		__esModule: true,
		default: MockTextBox
	};
});

jest.mock('@/components/ValueAccount', () => {
	const MockValueAccount = ({ address }) => <span>{address}</span>;

	return {
		__esModule: true,
		default: MockValueAccount
	};
});

describe('branding', () => {
	beforeEach(() => {
		mockPathname = '/blocks';
		mockUseStorage = jest.fn((key, initialValue) => [initialValue, jest.fn()]);
		mockUseToggle = jest.fn(initialValue => [initialValue, jest.fn()]);
	});

	it('renders the Symbol logo in the header from variant config', () => {
		// Arrange:
		const Header = require('@/components/Header').default;

		// Act:
		const { container } = render(<Header />);

		// Assert:
		expect(screen.getByAltText('Symbol')).toHaveAttribute('src', '/symbol/images/logo-symbol.png');
		expect(container.querySelector('header > div')).toHaveStyle({
			width: '10rem',
			height: '2.56rem'
		});
	});

	it('renders the Symbol logo in the footer from variant config', () => {
		// Arrange:
		const Footer = require('@/components/Footer').default;

		// Act:
		render(<Footer />);

		// Assert:
		expect(screen.getByAltText('Symbol')).toHaveAttribute('src', '/symbol/images/logo-symbol.png');
	});

	it('renders full footer links with the Symbol logo on the home page', () => {
		// Arrange:
		mockPathname = '/';
		const Footer = require('@/components/Footer').default;

		// Act:
		render(<Footer />);

		// Assert:
		expect(screen.getByAltText('Symbol')).toHaveAttribute('src', '/symbol/images/logo-symbol.png');
		expect(screen.getByRole('link', { name: 'footer_link_techRef' })).toHaveAttribute('href', 'https://docs.example/tech');
		expect(screen.getByRole('link', { name: 'footer_link_docs' })).toHaveAttribute('href', 'https://docs.example');
		expect(screen.getByRole('link', { name: 'footer_link_faucet' })).toHaveAttribute('href', 'https://faucet.example');
		expect(screen.getByRole('link', { name: 'footer_link_supernode' })).toHaveAttribute('href', 'https://supernode.example');
		expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/symbol');
		expect(screen.getByRole('link', { name: 'Discord' })).toHaveAttribute('href', 'https://discord.example');
		expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute('href', 'https://twitter.example');
	});

	it('renders profile controls when the header profile modal is open', () => {
		// Arrange:
		mockUseToggle = jest.fn()
			.mockReturnValueOnce([true, jest.fn()])
			.mockReturnValueOnce([false, jest.fn()])
			.mockReturnValueOnce([false, jest.fn()]);
		mockUseStorage = jest.fn((key, initialValue) => {
			if (Array.isArray(initialValue))
				return [[{ name: 'Alice', address: 'TA'.padEnd(40, 'A') }], jest.fn()];

			return [initialValue, jest.fn()];
		});
		const Header = require('@/components/Header').default;

		// Act:
		render(<Header />);

		// Assert:
		expect(screen.getByText('Language')).toBeInTheDocument();
		expect(screen.getByText('Currency')).toBeInTheDocument();
		expect(screen.getByText('Address Book')).toBeInTheDocument();
		expect(screen.getByText('Alice')).toBeInTheDocument();
		expect(screen.getByText('TA'.padEnd(40, 'A'))).toBeInTheDocument();
		expect(screen.getAllByAltText('Add')).toHaveLength(1);
	});
});
