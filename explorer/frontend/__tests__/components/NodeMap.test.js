import '@testing-library/jest-dom';
import NodeMap from '@/components/NodeMap';
import { render, screen } from '@testing-library/react';
import L from 'leaflet';

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
	beforeEach(() => {
		const map = {
			fitBounds: jest.fn(),
			invalidateSize: jest.fn(),
			remove: jest.fn(),
			setView: jest.fn(function () {
				return this;
			})
		};
		const layerGroup = {
			addTo: jest.fn(() => layerGroup),
			remove: jest.fn()
		};

		L.map.mockReturnValue(map);
		L.layerGroup.mockReturnValue(layerGroup);
		L.tileLayer.mockReturnValue({
			addTo: jest.fn()
		});
		L.circleMarker.mockReturnValue({
			addTo: jest.fn(),
			bindPopup: jest.fn()
		});
		L.marker.mockReturnValue({
			addTo: jest.fn(),
			bindPopup: jest.fn()
		});
	});

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

	it('does not include node roles in popup when role display is disabled', async () => {
		// Arrange:
		const marker = {
			addTo: jest.fn(),
			bindPopup: jest.fn()
		};
		L.circleMarker.mockReturnValue(marker);

		// Act:
		render(<NodeMap nodes={[{
			endpoint: 'https://symbol.example:3001',
			geoLocation: {
				lat: 50,
				lon: 6
			},
			name: 'symbol-node',
			roles: 3
		}]} />);
		await screen.findByTestId('node-map');

		// Assert:
		expect(marker.bindPopup).toHaveBeenCalled();
		expect(marker.bindPopup.mock.calls[0][0]).not.toContain('Peer API Node');
	});

	it('includes node roles in popup when role display is enabled', async () => {
		// Arrange:
		const marker = {
			addTo: jest.fn(),
			bindPopup: jest.fn()
		};
		L.circleMarker.mockReturnValue(marker);

		// Act:
		render(<NodeMap
			nodes={[{
				endpoint: 'https://symbol.example:3001',
				geoLocation: {
					lat: 50,
					lon: 6
				},
				name: 'symbol-node',
				roles: 3
			}]}
			showRoles
		/>);
		await screen.findByTestId('node-map');

		// Assert:
		expect(marker.bindPopup).toHaveBeenCalled();
		expect(marker.bindPopup.mock.calls[0][0]).toContain('Peer API Node');
	});
});
