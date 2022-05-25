import Home from './pages/Home';
import React from 'react';
import ReactDOM from 'react-dom';

// Arrange:
jest.mock('react-dom', () => ({ render: jest.fn() }));

describe('Application Root', () => {
	it('should render home page', () => {
		// Arrange more:
		const div = document.createElement('div');
		div.id = 'root';
		document.body.appendChild(div);

		// Act:
		require('./index.jsx');

		// Assert:
		expect(ReactDOM.render).toHaveBeenCalledWith(<React.StrictMode><Home/></React.StrictMode>, div);
	});
});
