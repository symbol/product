import Navbar from '.';
import helper from '../../utils/helper';
import testHelper from '../testHelper';
import { act, fireEvent, screen } from '@testing-library/react';

const context = {
	dispatch: {
		setNetwork: jest.fn(),
		setCurrency: jest.fn()
	},
	walletState: {},
	symbolSnap: {
		switchNetwork: jest.fn(),
		initialSnap: jest.fn(),
		getCurrency: jest.fn()
	}
};

describe('components/Navbar', () => {
	it('renders symbol logo', () => {
		// Arrange:
		testHelper.customRender(<Navbar />, context);

		// Act:
		const image = screen.getByAltText('Symbol logo');

		// Assert:
		expect(image).toHaveAttribute('src', '/symbol-logo.svg');
	});

	describe('dropdowns', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		const assertDropdown = dropdownName => {
			// Arrange:
			testHelper.customRender(<Navbar />, context);

			// Act:
			const dropdown = screen.getByText(dropdownName);

			// Assert:
			expect(dropdown).toBeInTheDocument();
		};

		const assertOptions = (dropdownName, options) => {
			// Arrange:
			testHelper.customRender(<Navbar />, context);
			const dropdown = screen.getByText(dropdownName);

			// Act:
			fireEvent.click(dropdown);

			// Assert:
			options.forEach(option => {
				const element = screen.getByText(option);
				expect(element).toBeInTheDocument();
			});
		};

		const assertInitialDropdownName = (state, expectLabel) => {
			// Arrange:
			context.walletState = state;

			// Act:
			testHelper.customRender(<Navbar />, context);

			// Assert:
			const label = screen.getByText(expectLabel);
			expect(label).toBeInTheDocument();
		};

		const runBasicDropdownTest = (dropdownName, options, mockHelperMethodName) => {
			it('renders dropdown', () => {
				assertDropdown(dropdownName);
			});

			it('renders options items', () => {
				assertOptions(dropdownName, options);
			});

			it(`renders nothing when selected same ${dropdownName}`, async () => {
				// Arrange:
				jest.spyOn(helper, 'setupSnap').mockReturnValue();

				testHelper.customRender(<Navbar />, context);

				const dropdown = screen.getByText(dropdownName);
				fireEvent.click(dropdown);

				const item = screen.getByText(options[1]);

				await act(async () => fireEvent.click(item));

				// Act:
				// Click on the same network
				await act(async () => fireEvent.click(item));

				// Assert:
				const selectedOption = screen.getByText(options[1]);
				expect(selectedOption).toBeInTheDocument();
				expect(helper.setupSnap).not.toHaveBeenNthCalledWith(2);
			});

			it(`sets selected ${dropdownName} when clicked on item`, async () => {
				// Arrange:
				jest.spyOn(helper, mockHelperMethodName).mockReturnValue();

				testHelper.customRender(<Navbar />, context);
				const dropdown = screen.getByText(dropdownName);
				fireEvent.click(dropdown);
				const item = screen.getByText(options[1]);

				// Act:
				await act(async () => fireEvent.click(item));

				// Assert:
				const selectedOption = screen.getByText(options[1]);

				expect(selectedOption).toBeInTheDocument();
				expect(helper[mockHelperMethodName]).toHaveBeenCalledWith(context.dispatch, context.symbolSnap, options[1].toLowerCase());
			});
		};

		const runBasicInitialDropdownNameTest = (dropdownName, states) => {
			it(`renders ${dropdownName} name when ${dropdownName} is set when initial`, () => {
				states.forEach(({
					state,
					expectLabel
				}) => {
					assertInitialDropdownName(state, expectLabel);
				});
			});
		};

		describe('network', () => {

			runBasicDropdownTest('Network', ['Mainnet', 'Testnet'], 'setupSnap');

			runBasicInitialDropdownNameTest('Network', [
				{
					state: {
						network: {
							networkName: 'mainnet'
						}
					},
					expectLabel: 'Mainnet'
				},
				{
					state: {
						network: {
							networkName: 'testnet'
						}
					},
					expectLabel: 'Testnet'
				},
				{
					state: {
						network: {
							networkName: undefined
						}
					},
					expectLabel: 'Network'
				}
			]);
		});

		describe('currency', () => {
			runBasicDropdownTest('Currency', ['USD', 'JPY'], 'getCurrency');

			runBasicInitialDropdownNameTest('Currency', [
				{
					state: {
						currency: {
							symbol: 'usd'
						}
					},
					expectLabel: 'USD'
				},
				{
					state: {
						currency: {
							symbol: 'jpy'
						}
					},
					expectLabel: 'JPY'
				},
				{
					state: {
						currency: {
							symbol: undefined
						}
					},
					expectLabel: 'Currency'
				}
			]);
		});
	});

	describe('connection status', () => {
		const assertConnectionStatus = (context, expectedResult) => {
			// Arrange:
			testHelper.customRender(<Navbar />, context);

			// Act:
			const connectionStatus = screen.getByRole('connection-status');

			// Assert:
			expect(connectionStatus).toHaveClass(expectedResult);
		};

		it('renders green when isSnapInstalled is true', () => {
			// Arrange:
			context.walletState.isSnapInstalled = true;

			assertConnectionStatus(context, 'bg-green');
		});

		it('renders red when isSnapInstalled is false', () => {
			// Arrange:
			context.walletState.isSnapInstalled = false;

			assertConnectionStatus(context, 'bg-red-500');
		});
	});
});
