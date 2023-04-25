import React from 'react';
import ReactDOM from 'react-dom';
import { registerRoot } from './registerRoot';

jest.mock('react-dom', () => ({
	render: jest.fn(),
}));

describe('registerRoot', () => {
	it('renders the given component inside a StrictMode wrapper and attaches it to the root element', () => {
		// Arrange:
		const TestComponent = () => <div>Test</div>;
		const rootElement = document.createElement('div');
		rootElement.id = 'root';
		document.body.appendChild(rootElement);

		// Act:
		registerRoot(TestComponent);

		// Assert:
		const renderCall = ReactDOM.render.mock.calls[0];
		const wrapperElement = renderCall[0];
		const targetElement = renderCall[1];

		expect(wrapperElement.type).toBe(React.StrictMode);
		expect(wrapperElement.props.children.type).toBe(TestComponent);
		expect(targetElement).toBe(rootElement);
	});
});
