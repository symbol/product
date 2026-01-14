import { Router, navigationRef } from '@/app/Router';

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	createNavigationContainerRef: () => ({
		goBack: jest.fn(),
		navigate: jest.fn(),
		reset: jest.fn()
	})
}));

describe('Router', () => {
	describe('goBack', () => {
		it('calls navigationRef.goBack', () => {
			// Act:
			Router.goBack();

			// Assert:
			expect(navigationRef.goBack).toHaveBeenCalled();
		});
	});

	describe('navigate methods', () => {
		const runNavigateMethodTest = config => {
			// Arrange:
			const { screenName, shouldReset } = config;
			const methodName = `goTo${screenName}`;
			const description = `navigates to ${screenName} screen${shouldReset ? ' with reset' : ''}`;

			it(description, () => {
				// Act:
				Router[methodName]();

				// Assert:
				if (shouldReset) {
					expect(navigationRef.reset).toHaveBeenCalledWith({
						index: 0,
						routes: [{ name: screenName }]
					});
				} else {
					expect(navigationRef.navigate).toHaveBeenCalledWith(screenName);
				}
			});
		};

		const tests = [
			{
				screenName: 'Welcome',
				shouldReset: true
			},
			{
				screenName: 'CreateWallet',
				shouldReset: false
			},
			{
				screenName: 'ImportWallet',
				shouldReset: false
			},
			{
				screenName: 'Home',
				shouldReset: true
			}
		];

		tests.forEach(runNavigateMethodTest);
	});
});
