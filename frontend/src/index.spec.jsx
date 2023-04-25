import * as loadHomeModule from './loadHome';
import * as registerRootModule from './registerRoot';

describe('index.js', () => {
	it('renders Home component when REACT_APP_BUILD_TARGET is "protocol"', async () => {
		// Arrange:
		jest.spyOn(registerRootModule, 'registerRoot').mockImplementation(jest.fn());
		jest.spyOn(loadHomeModule, 'loadHome').mockImplementation(jest.fn());

		process.env.REACT_APP_BUILD_TARGET = 'protocol';

		// Act:
		await import('./index');

		// Assert:
		expect(registerRootModule.registerRoot).toHaveBeenCalled();
		expect(loadHomeModule.loadHome).toHaveBeenCalledWith('protocol');
	});
});
