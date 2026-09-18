import '@testing-library/jest-dom';
import Header from '@/app/components/Header';
import { BACKEND_HEALTH_STATUS } from '@/app/constants';
import { render, screen } from '@testing-library/react';

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
	it('does not show a warning for an available healthy response', () => {
		// Act:
		const header = (
			<Header backendStatus={healthyStatus} backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE} isHealthRequestWarningEnabled />
		);
		render(header);

		// Assert:
		expect(screen.queryByText('message_healthGenericError')).not.toBeInTheDocument();
	});

	it('shows a generic warning for an initial health request failure state', () => {
		// Act: render the props Header receives after the initial request fails; this does not issue a request.
		const header = (
			<Header backendStatus={null} backendHealthStatus={BACKEND_HEALTH_STATUS.ERROR} isHealthRequestWarningEnabled />
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
	});

	it('shows a generic warning for an unhealthy response without sync details', () => {
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

	it('keeps the existing unhealthy-response warning when unavailable warnings are disabled', () => {
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

	it('keeps the NEM synchronization warning when its timestamp is unavailable', () => {
		// Act:
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [{ type: 'synchronization' }], lastDBSyncedAt: null }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
			/>
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthSyncError')).toBeInTheDocument();
	});

	it('renders the synchronization error message key', () => {
		// Act:
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [{ type: 'synchronization' }] }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
				isHealthRequestWarningEnabled
			/>
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthSyncError')).toBeInTheDocument();
	});

	it('uses a generic warning for a Symbol sync error without a timestamp', () => {
		// Act:
		const header = (
			<Header
				backendStatus={{ ...healthyStatus, isHealthy: false, errors: [{ type: 'synchronization' }], lastDBSyncedAt: null }}
				backendHealthStatus={BACKEND_HEALTH_STATUS.AVAILABLE}
				isHealthRequestWarningEnabled
			/>
		);
		render(header);

		// Assert:
		expect(screen.getByText('message_healthGenericError')).toBeInTheDocument();
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
