import '@testing-library/jest-dom';
import * as HealthService from '@/app/api/health';
import { AppComponent } from '@/app/pages/_app';
import { act, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/app/api/health', () => ({
	__esModule: true,
	fetchBackendHealthStatus: jest.fn(),
	healthConfig: process.env.NEXT_PUBLIC_EXPLORER_VARIANT === 'symbol'
		? { isUnavailableWarningEnabled: true }
		: { isUnavailableWarningEnabled: false }
}));

jest.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/other', locale: 'en', push: jest.fn() })
}));

jest.mock('next-i18next', () => ({
	appWithTranslation: Component => Component
}));

jest.mock('@/app/contexts/ConfigContext', () => ({
	__esModule: true,
	ConfigProvider: ({ children }) => children,
	useConfig: jest.fn()
}));

jest.mock('@/app/components/Header', () => ({
	__esModule: true,
	default: ({ backendStatus, backendHealthStatus, isHealthRequestWarningEnabled }) => (
		<div data-testid="backend-health-state">
			{isHealthRequestWarningEnabled ? 'enabled' : 'disabled'}:{backendHealthStatus}:
			{backendStatus?.isHealthy === undefined ? 'null' : backendStatus.isHealthy.toString()}
		</div>
	)
}));

jest.mock('@/app/components/Footer', () => ({
	__esModule: true,
	default: () => null
}));

jest.mock('@/app/components/PageLoadingIndicator', () => ({
	__esModule: true,
	default: () => null
}));

jest.mock('react-toastify', () => ({
	ToastContainer: () => null
}));

const renderApp = () => {
	const app = <AppComponent Component={() => <div data-testid="page-content">content</div>} pageProps={{}} appConfig={{}} />;

	return render(app);
};

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

const isSymbolVariant = process.env.NEXT_PUBLIC_EXPLORER_VARIANT === 'symbol';
const healthWarningMode = isSymbolVariant ? 'enabled' : 'disabled';
const itSymbol = isSymbolVariant ? it : it.skip;
const itNem = isSymbolVariant ? it.skip : it;

describe('AppComponent backend health lifecycle', () => {
	afterEach(() => {
		HealthService.fetchBackendHealthStatus.mockReset();
		jest.clearAllTimers();
	});

	it('shows page content and the initial health state while the response is pending', () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus.mockReturnValue(new Promise(() => {}));

		// Act:
		renderApp();

		// Assert:
		expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:initial:null`);
		expect(screen.getByTestId('page-content')).toBeInTheDocument();
	});

	it('transitions to an available health state when the response completes and preserves page content', async () => {
		// Arrange:
		let resolveHealth;
		const healthPromise = new Promise(resolve => {
			resolveHealth = resolve;
		});
		HealthService.fetchBackendHealthStatus.mockReturnValue(healthPromise);
		renderApp();

		// Sanity check: the response is still pending and the initial state is visible.
		expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:initial:null`);

		// Act:
		await act(async () => {
			resolveHealth({ isHealthy: true });
		});

		// Assert:
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:available:true`));
		expect(screen.getByTestId('page-content')).toBeInTheDocument();
	});

	itSymbol('marks a null health response as unavailable', async () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus.mockResolvedValue(null);

		// Act:
		renderApp();

		// Assert:
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent('enabled:unavailable:null'));
	});

	it('keeps an unhealthy backend response available for the warning UI', async () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus.mockResolvedValue({ isHealthy: false });

		// Act:
		renderApp();

		// Assert:
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:available:false`));
	});

	it('does not automatically retry a failed initial health request', async () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus
			.mockRejectedValueOnce(Error('health unavailable'))
			.mockResolvedValue({ isHealthy: true });

		// Act:
		const { unmount } = renderApp();
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:error:null`));
		await act(async () => {
			jest.advanceTimersByTime(120000);
		});

		// Assert:
		expect(HealthService.fetchBackendHealthStatus).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:error:null`);
		expect(screen.getByTestId('page-content')).toBeInTheDocument();

		// A new mount performs a new initial request.
		unmount();
		renderApp();
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:available:true`));
		expect(HealthService.fetchBackendHealthStatus).toHaveBeenCalledTimes(2);
	});

	it('does not poll after the initial health request', async () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus.mockResolvedValue({ isHealthy: true });

		// Act:
		renderApp();
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		act(() => {
			jest.advanceTimersByTime(120000);
		});
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		// Assert:
		expect(HealthService.fetchBackendHealthStatus).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('backend-health-state')).toHaveTextContent(`${healthWarningMode}:available:true`);
	});

	itNem('passes unavailable state and the warning-disabled prop to the mocked Header under the NEM test variant', async () => {
		// Arrange:
		HealthService.fetchBackendHealthStatus.mockResolvedValue(null);

		// Act:
		renderApp();
		await waitFor(() => expect(screen.getByTestId('backend-health-state')).toHaveTextContent('disabled:unavailable:null'));

		// Assert:
		expect(screen.getByTestId('backend-health-state')).toHaveTextContent('disabled:');
	});
});
