import '@testing-library/jest-dom';
import NodeMap from '@/components/NodeMap';
import { render, screen } from '@testing-library/react';

jest.mock('leaflet', () => ({
	__esModule: true,
	default: {
		circleMarker: jest.fn(() => ({
			addTo: jest.fn(),
			bindPopup: jest.fn()
		})),
		latLngBounds: jest.fn(() => ({})),
		layerGroup: jest.fn(() => ({
			addTo: jest.fn(() => ({
				remove: jest.fn()
			}))
		})),
		map: jest.fn(() => ({
			fitBounds: jest.fn(),
			invalidateSize: jest.fn(),
			remove: jest.fn(),
			setView: jest.fn(function () {
				return this;
			})
		})),
		marker: jest.fn(() => ({
			addTo: jest.fn(),
			bindPopup: jest.fn()
		})),
		tileLayer: jest.fn(() => ({
			addTo: jest.fn()
		}))
	}
}));

describe('NodeMap', () => {
	it('renders only empty state when no node locations are available', () => {
		// Act:
		render(<NodeMap nodes={[{ name: 'node-without-location', geoLocation: null }]} />);

		// Assert:
		expect(screen.getByText('message_noNodeLocations')).toBeInTheDocument();
		expect(screen.queryByTestId('node-map')).not.toBeInTheDocument();
	});

	it('renders map container when node locations are available', () => {
		// Arrange:
		const nodes = [
			{
				endpoint: 'https://symbol.example:3001',
				geoLocation: {
					lat: 50,
					lon: 6
				},
				name: 'symbol-node',
				roles: 3
			}
		];

		// Act:
		render(<NodeMap nodes={nodes} />);

		// Assert:
		expect(screen.getByTestId('node-map')).toBeInTheDocument();
		expect(screen.queryByText('message_noNodeLocations')).not.toBeInTheDocument();
	});
});
