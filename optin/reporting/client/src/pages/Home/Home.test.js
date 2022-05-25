import Home from './index';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('../Completed', () => () => <div></div>);
jest.mock('../Requests', () => () => <div></div>);

const lastUpdated = 'Thu, 17 May 2022 21:21:00 GMT';
const mockVersionAPIFetch = () =>
	fetch.mockResponse(JSON.stringify({versionId:'IFJMGtOlbRC57YGxuJeWjy98YQ4lG6ab', lastUpdated}));

beforeEach(() => {
	fetch.resetMocks();
	jest.resetModules();
});

describe('Home', () => {
	it('should render Home page', async () => {
		// Arrange + Act:
		mockVersionAPIFetch();
		render(<Home />);

		// Assert:
		await waitFor(() => {
			expect(screen.getByText('Generated at:')).toBeInTheDocument();
		});
		expect(screen.getByText('Opt-in Summary')).toBeInTheDocument();
	});

	it('should render Completed as default active tab', async () => {
		// Arrange + Act:
		mockVersionAPIFetch();
		render(<Home />);

		// Assert:
		expect(within(await screen.findByRole('tab', {selected: true})).getByText('Completed')).toBeInTheDocument();
		expect(within(await screen.findByRole('tab', {selected: false})).getByText('In Progress')).toBeInTheDocument();
	});

	it('should change the active tab from Completed to In Progress when In Progress tab is clicked', async () => {
		// Arrange:
		mockVersionAPIFetch();
		render(<Home />);

		// Act:
		const inProgressTabTitle = screen.getByText('In Progress');
		fireEvent.click(inProgressTabTitle);

		// Assert:
		expect(within(await screen.findByRole('tab', {selected: false})).getByText('Completed')).toBeInTheDocument();
		expect(within(await screen.findByRole('tab', {selected: true})).getByText('In Progress')).toBeInTheDocument();
	});

	it('should change the active tab from In Progress to Completed when Completed tab is clicked', async () => {
		// Arrange:
		mockVersionAPIFetch();
		render(<Home />);
		const inProgressTabTitle = screen.getByText('In Progress');
		fireEvent.click(inProgressTabTitle);

		// Act:
		const completedTabTitle = screen.getByText('Completed');
		fireEvent.click(completedTabTitle);

		// Assert:
		expect(within(await screen.findByRole('tab', {selected: true})).getByText('Completed')).toBeInTheDocument();
		expect(within(await screen.findByRole('tab', {selected: false})).getByText('In Progress')).toBeInTheDocument();
	});

	it('should fetch and set generated data version', async () => {
		// Assert:
		mockVersionAPIFetch();
		const expectedGeneratedAtText = `Generated at: ${lastUpdated}`;

		// Act:
		render(<Home />);

		// Assert:
		expect(await screen.findByText(expectedGeneratedAtText)).toBeInTheDocument();
	});
});
