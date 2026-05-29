import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import * as NodeService from '@/api/nodes';
import NodeList, { getServerSideProps } from '@/pages/nodes/index';
import { pageConfig } from '@/variants';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('@/api/nodes', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nodes')
	};
});

describe('NodeList', () => {
	const originalNodesConfig = { ...pageConfig.nodes };
	const nodes = [
		{
			address: 'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
			balance: 123.456789,
			endpoint: 'https://symbol.example:3001',
			finalizedHeight: 1230,
			geoLocation: {
				lat: 50,
				lon: 6
			},
			height: 1234,
			mainPublicKey: 'A'.repeat(64),
			name: 'symbol-node',
			nodePublicKey: 'B'.repeat(64),
			roles: 3,
			version: '1.0.3.8'
		},
		{
			address: 'TCTEST3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
			balance: 456.789123,
			endpoint: 'https://voting.example:3001',
			finalizedHeight: 2230,
			geoLocation: {
				lat: 35,
				lon: 139
			},
			height: 2234,
			mainPublicKey: 'E'.repeat(64),
			name: 'voting-node',
			nodePublicKey: 'F'.repeat(64),
			roles: 5,
			version: '1.0.3.9'
		}
	];
	const nemNodes = [
		{
			balance: 0,
			endpoint: 'http://nem.example:7890',
			finalizedHeight: 990,
			height: 1000,
			mainPublicKey: 'C'.repeat(64),
			name: 'nem-node',
			nodePublicKey: 'D'.repeat(64),
			roles: 255,
			version: '0.6.101'
		}
	];

	afterEach(() => {
		Object.assign(pageConfig.nodes, originalNodesConfig);
		jest.restoreAllMocks();
		setDevice('desktop');
	});

	describe('getServerSideProps', () => {
		it('fetches node list', async () => {
			// Arrange:
			const fetchNodeList = jest.spyOn(NodeService, 'fetchNodeList');
			fetchNodeList.mockResolvedValue(nodes);

			// Act:
			const result = await getServerSideProps({ locale: 'en' });

			// Assert:
			expect(fetchNodeList).toHaveBeenCalledWith();
			expect(result).toEqual({
				props: {
					nodes
				}
			});
		});
	});

	describe('page', () => {
		it('renders requested node fields with Symbol address column enabled on desktop', () => {
			// Arrange:
			pageConfig.nodes.showAddress = true;
			pageConfig.nodes.showRoles = true;

			// Act:
			render(<NodeList nodes={nodes} />);

			// Assert:
			[
				'table_field_address',
				'table_field_name',
				'table_field_roles',
				'table_field_balance',
				'table_field_version',
				'table_field_height',
				'table_field_finalizedHeight',
				'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				'symbol-node',
				'1.0.3.8'
			].forEach(text => {
				expect(screen.getByText(text)).toBeInTheDocument();
			});
			expect(screen.getAllByText('Peer API Node').length).toBeGreaterThan(0);
			expect(screen.queryByText('table_field_endpoint')).not.toBeInTheDocument();
			expect(screen.queryByText('https://symbol.example:3001')).not.toBeInTheDocument();
			expect(screen.getByText('1234')).toBeInTheDocument();
			expect(screen.getByText('1230')).toBeInTheDocument();
			expect(screen.getByText('123')).toBeInTheDocument();
			expect(screen.getByText('.456789')).toBeInTheDocument();
			expect(screen.getByTestId('node-map')).toBeInTheDocument();
			const stats = screen.getByTestId('node-stats');
			expect(within(stats).getByText('field_totalNodes')).toBeInTheDocument();
			expect(within(stats).getByText('2')).toBeInTheDocument();
			expect(within(stats).getByText('Peer API Node')).toBeInTheDocument();
			expect(within(stats).getByText('Peer Voting Node')).toBeInTheDocument();
		});

		it('renders NEM-shaped node data without address column when disabled by variant config', () => {
			// Arrange:
			pageConfig.nodes.showAddress = false;

			// Act:
			render(<NodeList nodes={nemNodes} />);

			// Assert:
			expect(screen.queryByText('table_field_address')).not.toBeInTheDocument();
			expect(screen.queryByText('TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY')).not.toBeInTheDocument();
			expect(screen.getByText('nem-node')).toBeInTheDocument();
			expect(screen.getByText('http://nem.example:7890')).toBeInTheDocument();
			expect(screen.getByText('0.6.101')).toBeInTheDocument();
			expect(screen.getByText('1000')).toBeInTheDocument();
			expect(screen.getByText('990')).toBeInTheDocument();
			const stats = screen.getByTestId('node-stats');
			expect(within(stats).getByText('field_totalNodes')).toBeInTheDocument();
			expect(within(stats).getByText('1')).toBeInTheDocument();
			expect(within(stats).queryByText('Peer API Voting Node')).not.toBeInTheDocument();
		});

		it('renders NEM-shaped node data on mobile without empty address field when disabled by variant config', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.nodes.showAddress = false;

			// Act:
			render(<NodeList nodes={nemNodes} />);

			// Assert:
			expect(screen.queryByText('field_address')).not.toBeInTheDocument();
			expect(screen.queryByText('TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY')).not.toBeInTheDocument();
			expect(screen.getByText('nem-node')).toBeInTheDocument();
			expect(screen.getByText('http://nem.example:7890')).toBeInTheDocument();
			expect(screen.getByText('field_balance')).toBeInTheDocument();
			expect(screen.getByText('field_height')).toBeInTheDocument();
			expect(screen.getByText('field_finalizedHeight')).toBeInTheDocument();
		});

		it('renders Symbol node roles on mobile when enabled by variant config', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.nodes.showAddress = true;
			pageConfig.nodes.showRoles = true;

			// Act:
			render(<NodeList nodes={nodes} />);

			// Assert:
			expect(screen.getByText('symbol-node')).toBeInTheDocument();
			expect(screen.getAllByText('Peer API Node').length).toBeGreaterThan(0);
			expect(screen.queryByText('https://symbol.example:3001')).not.toBeInTheDocument();
		});

		it('filters Symbol nodes by selected role', () => {
			// Arrange:
			pageConfig.nodes.showAddress = true;
			pageConfig.nodes.showRoles = true;

			// Act:
			render(<NodeList nodes={nodes} />);
			fireEvent.click(screen.getByRole('button', { name: 'filter_role' }));
			const dialog = screen.getByRole('dialog');
			[
				'Peer Node',
				'API Node',
				'Peer API Node',
				'Voting Node',
				'Peer Voting Node',
				'API Voting Node',
				'Peer API Voting Node'
			].forEach(text => {
				expect(within(dialog).getByText(text)).toBeInTheDocument();
			});
			fireEvent.click(within(dialog).getByText('Peer Voting Node'));

			// Assert:
			expect(screen.queryByText('symbol-node')).not.toBeInTheDocument();
			expect(screen.getByText('voting-node')).toBeInTheDocument();
			expect(screen.getAllByText('Peer Voting Node').length).toBeGreaterThan(0);
			const stats = screen.getByTestId('node-stats');
			expect(within(stats).getByText('field_totalNodes')).toBeInTheDocument();
			expect(within(stats).getByText('2')).toBeInTheDocument();
		});

		it('does not render role filter when role display is disabled by variant config', () => {
			// Arrange:
			pageConfig.nodes.showAddress = false;
			pageConfig.nodes.showRoles = false;

			// Act:
			render(<NodeList nodes={nemNodes} />);

			// Assert:
			expect(screen.queryByText('filter_role')).not.toBeInTheDocument();
			expect(screen.getByText('http://nem.example:7890')).toBeInTheDocument();
		});
	});
});
