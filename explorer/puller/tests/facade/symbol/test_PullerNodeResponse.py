from symbollightapi.model.Exceptions import NodeException

from .puller_test_utils import (
	FakeConnector,
	ResponseConnector,
	SymbolPullerTestBase,
	create_chain_info,
	create_network_properties,
	create_node_block
)


class SymbolPullerNodeResponseTest(SymbolPullerTestBase):

	def test_rejects_missing_chain_height(self):
		# Arrange:
		chain_info = create_chain_info()
		del chain_info['height']
		connector = ResponseConnector({
			'chain/info': chain_info,
			'network/properties': create_network_properties()
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(connector, KeyError, 'height')

	def test_rejects_missing_epoch_adjustment(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': create_chain_info(),
			'network/properties': {'network': {}}
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			KeyError,
			'epochAdjustment'
		)

	def test_rejects_missing_block_hash(self):
		# Arrange:
		block = create_node_block(1)
		del block['meta']['hash']
		connector = FakeConnector(1, {0: [block]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(connector, KeyError, 'hash')

	def _assert_rejects_missing_block_field(self, container, field_name):
		# Arrange:
		block = create_node_block(1)
		del block[container][field_name]
		connector = FakeConnector(1, {0: [block]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			KeyError,
			field_name
		)

	def test_rejects_missing_state_hash_sub_cache_roots(self):
		self._assert_rejects_missing_block_field(
			'meta',
			'stateHashSubCacheMerkleRoots'
		)

	def test_rejects_missing_fee_multiplier(self):
		self._assert_rejects_missing_block_field('block', 'feeMultiplier')

	def test_rejects_missing_beneficiary_address(self):
		self._assert_rejects_missing_block_field(
			'block',
			'beneficiaryAddress'
		)

	def test_rejects_missing_proof_gamma(self):
		self._assert_rejects_missing_block_field('block', 'proofGamma')

	def test_rejects_missing_proof_verification_hash(self):
		self._assert_rejects_missing_block_field(
			'block',
			'proofVerificationHash'
		)

	def test_rejects_missing_proof_scalar(self):
		self._assert_rejects_missing_block_field('block', 'proofScalar')

	def test_rejects_missing_state_hash(self):
		self._assert_rejects_missing_block_field('block', 'stateHash')

	def test_rejects_missing_transactions_hash(self):
		self._assert_rejects_missing_block_field('block', 'transactionsHash')

	def test_rejects_missing_receipts_hash(self):
		self._assert_rejects_missing_block_field('block', 'receiptsHash')

	def test_rejects_malformed_block_height(self):
		# Arrange:
		block = create_node_block(1)
		block['block']['height'] = 'not-a-height'
		connector = FakeConnector(1, {0: [block]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'invalid literal'
		)

	def test_rejects_symbol_node_api_error_response(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': create_chain_info(),
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {
				'code': 'InvalidArgument',
				'message': 'offset has an invalid format'
			}
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			NodeException,
			'InvalidArgument: offset has an invalid format'
		)

	def test_rejects_malformed_block_page_response(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': create_chain_info(),
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {
				'pagination': {'pageNumber': 1, 'pageSize': 100}
			}
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol block page response'
		)

	def test_sync_block_headers_rejects_invalid_max_height(self):
		# Arrange:
		connector = FakeConnector(1, {})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'max_height must be greater than or equal to 1',
			max_height=0
		)

	def test_sync_block_headers_rejects_short_page_before_chain_height(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{0: [create_node_block(1), create_node_block(2)]}
		)

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Short Symbol block page ended at height 2 '
			'before chain height 3'
		)
