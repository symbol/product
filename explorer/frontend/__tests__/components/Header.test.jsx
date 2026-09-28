import '@testing-library/jest-dom';
import Header from '@/app/components/Header';
import { BACKEND_HEALTH_STATUS } from '@/app/constants';
import { render, screen } from '@testing-library/react';

jest.mock('next-i18next', () => ({
	useTranslation: () => ({
		t: (key, options) => options ? `${key}:${options.lastSyncedAt}` : key
	})
}));

jest.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/', locale: 'en', push: jest.fn() })
}));

const healthyStatus = {
	isHealthy: true,
	errors: [],
	lastDBHeight: 100,
	lastDBSyncedAt: '2026-09-15 01:02:03'
};

describe('Header backend health warning', () => {
	it('does not show generic or synchronization warnings for an available healthy response when request warnings are enabled', () => {
		// Act:
		const header = (
			<Header backendStatus={healthyStatus} backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE} isHealthRequestWarningEnabled />
		);
		render(header);

		// Assert:
		expect(screen.queryByText('message_healthGenericError')).not.toBeInTheDocument();
		expect(screen.queryByText(/message_healthSyncError/)).not.toBeInTheDocument();
	});

	it('shows a generic warning for an initial request failure when request warnings are enabled', () => {
		// Act: render the props Header receives after the initial request fails; this does not issue a request.
		const header = (
			<Header backendStatus={null} backendHealthStatus={BACKEND_HEALTH_STATUS.ERROR} isHealthRequestWarningEnabled />
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
	});

	it('shows a generic warning for an unhealthy response without sync details when request warnings are enabled', () => {
		// Act:
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [], lastDBSyncedAt: null, lastDBHeight: null }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
				isHealthRequestWarningEnabled
			/>
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
	});

	it('shows an unhealthy-response warning when request-failure warnings are disabled', () => {
		// Act:
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [] }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
			/>
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
	});

	it.each([
		[
			'warning disabled with a null synchronization timestamp',
			false,
			{
				isHealthy: false,
				errors: [{ type: 'synchronization' }],
				lastDBHeight: 100,
				lastDBSyncedAt: null
			}
		],
		[
			'warning enabled with a null synchronization timestamp',
			true,
			{
				isHealthy: false,
				errors: [{ type: 'synchronization' }],
				lastDBHeight: 100,
				lastDBSyncedAt: null
			}
		],
		[
			'warning disabled with no synchronization timestamp property',
			false,
			{
				isHealthy: false,
				errors: [{ type: 'synchronization' }],
				lastDBHeight: 100
			}
		],
		[
			'warning enabled with no synchronization timestamp property',
			true,
			{
				isHealthy: false,
				errors: [{ type: 'synchronization' }],
				lastDBHeight: 100
			}
		]
	])(
		'shows a generic warning for a synchronization error when %s',
		(_scenario, isHealthRequestWarningEnabled, backendStatus) => {
			// Arrange:
			const header = (
				<Header
					backendStatus={backendStatus}
					backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
					isHealthRequestWarningEnabled={isHealthRequestWarningEnabled}
				/>
			);

			// Act:
			render(header);

			// Assert:
			expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
			expect(screen.queryByText(/message_healthSyncError/)).not.toBeInTheDocument();
			expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
		}
	);

	it('renders the synchronization warning with the formatted synced date', () => {
		// Arrange:
		jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [{ type: 'synchronization' }] }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
				isHealthRequestWarningEnabled
			/>
		);

		// Act:
		render(header);

		// Assert:
		expect(screen.getByText('message_healthSyncError:month_sep 15, 2026 • 01:02:03')).toBeInTheDocument();
	});

	it('hides the warning when Header props change from ERROR to AVAILABLE', () => {
		// Arrange:
		const errorProps = {
			backendStatus: null,
			backendHealthStatus: BACKEND_HEALTH_STATUS.ERROR,
			isHealthRequestWarningEnabled: true
		};
		const recoveredProps = {
			backendStatus: healthyStatus,
			backendHealthStatus: BACKEND_HEALTH_STATUS.AVAILABLE,
			isHealthRequestWarningEnabled: true
		};

		// Sanity check: the initial error is visible before the recovery render.
		const { rerender } = render(<Header {...errorProps} />);
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();

		// Act: rerender with new status props; this does not perform a health request or prove automatic recovery.
		rerender(<Header {...recoveredProps} />);

		// Assert:
		expect(screen.queryByText('message_healthGenericError')).not.toBeInTheDocument();
	});

	it('does not show the unavailable-request warning when the variant disables it', () => {
		// Act:
		render(<Header backendStatus={null} backendHealthStatus={BACKEND_HEALTH_STATUS.ERROR} />);

		// Assert:
		expect(screen.queryByText('message_healthGenericError')).not.toBeInTheDocument();
	});
});
