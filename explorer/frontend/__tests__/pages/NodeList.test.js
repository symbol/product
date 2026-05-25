import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import * as NodeService from '@/api/nodes';
import NodeList, { getServerSideProps } from '@/pages/nodes/index';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

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
			height: 1234,
			mainPublicKey: 'A'.repeat(64),
			name: 'symbol-node',
			nodePublicKey: 'B'.repeat(64),
			roles: 3,
			version: '1.0.3.8'
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

			// Act:
			render(<NodeList nodes={nodes} />);

			// Assert:
			[
				'table_field_address',
				'table_field_name',
				'table_field_endpoint',
				'table_field_balance',
				'table_field_version',
				'table_field_height',
				'table_field_finalizedHeight',
				'TCNAOT3ZKSU45DVFCV3RHMTWHDKL4VS3LG33ELY',
				'symbol-node',
				'https://symbol.example:3001',
				'1.0.3.8'
			].forEach(text => {
				expect(screen.getByText(text)).toBeInTheDocument();
			});
			expect(screen.getByText('1234')).toBeInTheDocument();
			expect(screen.getByText('1230')).toBeInTheDocument();
			expect(screen.getByText('123')).toBeInTheDocument();
			expect(screen.getByText('.456789')).toBeInTheDocument();
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
	});
});
