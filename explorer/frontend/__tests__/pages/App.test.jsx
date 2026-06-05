import { render, waitFor } from '@testing-library/react';

jest.mock('next-i18next', () => ({
	appWithTranslation: Component => Component
}));

jest.mock('next/router', () => ({
	useRouter: () => ({
		asPath: '/',
		locale: 'en',
		push: jest.fn()
	})
}));

jest.mock('@/utils', () => ({
	useStorage: jest.fn(() => [null])
}));

jest.mock('@/contexts/ConfigContext', () => ({
	__esModule: true,
	ConfigProvider: ({ children }) => <>{children}</>,
	useConfig: jest.fn()
}));

jest.mock('@/api/health', () => ({
	fetchBackendHealthStatus: jest.fn().mockResolvedValue(null)
}));

jest.mock('react-toastify', () => ({
	ToastContainer: () => null
}));

jest.mock('@/components/Footer', () => {
	const MockFooter = () => <footer />;

	return MockFooter;
});

jest.mock('@/components/Header', () => {
	const MockHeader = () => <header />;

	return MockHeader;
});

jest.mock('@/components/PageLoadingIndicator', () => {
	const MockPageLoadingIndicator = () => null;

	return MockPageLoadingIndicator;
});

describe('App', () => {
	it('escapes app config in the inline bootstrap script', async () => {
		// Arrange:
		const App = require('@/pages/_app').default;
		const Component = () => <main>page content</main>;
		const appConfig = {
			SOCIAL_URL_GITHUB: '</script><script>alert(1)</script>'
		};

		// Act:
		const { container } = render(<App Component={Component} pageProps={{}} appConfig={appConfig} />);
		await waitFor(() => expect(container.querySelector('main')).toHaveTextContent('page content'));

		// Assert:
		const inlineScript = container.querySelector('script').textContent;
		expect(inlineScript).toContain('\\u003c/script>');
		expect(inlineScript).not.toContain('</script>');
	});
});
