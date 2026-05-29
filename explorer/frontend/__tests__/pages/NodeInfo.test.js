import '@testing-library/jest-dom';
import * as NodeService from '@/api/nodes';
import NodeInfo, { getServerSideProps } from '@/pages/nodes/[publicKey]';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/nodes', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nodes')
	};
});

describe('NodeInfo', () => {
	const originalNodesConfig = { ...pageConfig.nodes };
	const nodeInfo = {
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
		restVersion: '2.4.4',
		roles: 3,
		version: '1.0.3.8'
	};

	afterEach(() => {
		Object.assign(pageConfig.nodes, originalNodesConfig);
		jest.restoreAllMocks();
	});

	describe('getServerSideProps', () => {
		it('returns node info matching public key', async () => {
			// Arrange:
			const fetchNodeList = jest.spyOn(NodeService, 'fetchNodeList');
			fetchNodeList.mockResolvedValue([nodeInfo]);

			// Act:
			const result = await getServerSideProps({ locale: 'en', params: { publicKey: nodeInfo.mainPublicKey } });

			// Assert:
			expect(fetchNodeList).toHaveBeenCalledWith();
			expect(result).toEqual({
				props: {
					nodeInfo
				}
			});
		});

		it('returns not found when node is missing', async () => {
			// Arrange:
			const fetchNodeList = jest.spyOn(NodeService, 'fetchNodeList');
			fetchNodeList.mockResolvedValue([nodeInfo]);

			// Act:
			const result = await getServerSideProps({ locale: 'en', params: { publicKey: 'C'.repeat(64) } });

			// Assert:
			expect(result).toEqual({ notFound: true });
		});
	});

	describe('page', () => {
		it('renders Symbol node role in the primary node section when enabled', () => {
			// Arrange:
			pageConfig.nodes.showRoles = true;

			// Act:
			render(<NodeInfo nodeInfo={nodeInfo} />);

			// Assert:
			expect(screen.getByText('field_roles')).toBeInTheDocument();
			expect(screen.getByText('Peer API Node')).toBeInTheDocument();
			expect(screen.getByText('symbol-node')).toBeInTheDocument();
			expect(screen.getByText('https://symbol.example:3001')).toBeInTheDocument();
			expect(screen.getByText('field_height')).toBeInTheDocument();
			expect(screen.getByText('1234')).toBeInTheDocument();
			expect(screen.getByText('field_finalizedHeight')).toBeInTheDocument();
			expect(screen.getByText('1230')).toBeInTheDocument();
			expect(screen.getByText('field_version')).toBeInTheDocument();
			expect(screen.getByText('1.0.3.8')).toBeInTheDocument();
			expect(screen.getByText('field_restVersion')).toBeInTheDocument();
			expect(screen.getByText('2.4.4')).toBeInTheDocument();
			expect(screen.getByText('section_nodeLocation')).toBeInTheDocument();
			expect(screen.getByTestId('node-map')).toBeInTheDocument();
		});

		it('does not render node role when disabled by variant config', () => {
			// Arrange:
			pageConfig.nodes.showRoles = false;

			// Act:
			render(<NodeInfo nodeInfo={nodeInfo} />);

			// Assert:
			expect(screen.queryByText('field_roles')).not.toBeInTheDocument();
			expect(screen.queryByText('Peer API Node')).not.toBeInTheDocument();
		});
	});
});
