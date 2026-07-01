from datetime import datetime, timezone
from decimal import Decimal
from unittest import TestCase

from rest.model.symbol.Block import SymbolBlockView


def _expected_list_dict():
	return {
		'height': 2,
		'hash': '01',
		'previousHash': '02',
		'timestamp': '2026-01-02T03:04:05Z',
		'networkTimestamp': 1234,
		'harvester': 'TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
		'beneficiaryAddress': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		'totalFee': 1.234567,
		'transactionCount': 7,
		'statementCount': 3,
		'blockReward': None,
		'isFinalized': True,
		'difficulty': '100000000000000'
	}


class SymbolBlockViewTest(TestCase):
	@staticmethod
	def _create_block_view():
		return SymbolBlockView(
			height=2,
			block_hash=b'\x01',
			previous_hash=b'\x02',
			timestamp=datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc),
			network_timestamp=1234,
			total_fee=Decimal('1234567'),
			transaction_count=7,
			statement_count=3,
			difficulty=Decimal('100000000000000'),
			fee_multiplier=100,
			block_type='nemesis',
			harvester='TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
			beneficiary_address='TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			signature=b'\x03',
			size=456,
			proof_gamma=b'\x04',
			proof_verification_hash=b'\x05',
			proof_scalar=b'\x06',
			state_hash=b'\x07',
			transactions_hash=b'\x08',
			receipts_hash=b'\x09',
			state_hash_sub_cache_roots=['ROOT'],
			voting_eligible_accounts_count=4,
			harvesting_eligible_accounts_count=17,
			total_voting_balance=Decimal('19000235663367'),
			previous_importance_block_hash=b'\x0A',
			is_finalized=True
		)

	def test_can_convert_to_list_dict(self):
		# Arrange:
		block_view = self._create_block_view()

		# Act:
		result = block_view.to_dict()

		# Assert:
		self.assertEqual(_expected_list_dict(), result)

	def test_can_convert_to_detail_dict(self):
		# Arrange:
		block_view = self._create_block_view()

		# Act:
		result = block_view.to_detail_dict()

		# Assert:
		self.assertEqual({
			**_expected_list_dict(),
			'signature': '03',
			'size': 456,
			'feeMultiplier': 100,
			'proofGamma': '04',
			'proofVerificationHash': '05',
			'proofScalar': '06',
			'stateHash': '07',
			'stateHashSubCacheMerkleRoots': ['ROOT'],
			'receiptsHash': '09',
			'transactionsHash': '08',
			'votingEligibleAccountsCount': 4,
			'harvestingEligibleAccountsCount': '17',
			'totalVotingBalance': '19000235663367',
			'previousImportanceBlockHash': '0A',
			'blockType': 'nemesis'
		}, result)

	def test_can_convert_empty_state_hash_sub_cache_roots(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.state_hash_sub_cache_roots = []

		# Act:
		result = block_view.to_detail_dict()

		# Assert:
		self.assertEqual([], result['stateHashSubCacheMerkleRoots'])

	def test_can_format_string_timestamp(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.timestamp = '2026-01-02 03:04:05'

		# Act:
		result = block_view.to_dict()

		# Assert:
		self.assertEqual('2026-01-02T03:04:05', result['timestamp'])

	def test_can_format_naive_datetime_as_utc(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.timestamp = datetime(2026, 1, 2, 3, 4, 5)

		# Act:
		result = block_view.to_dict()

		# Assert:
		self.assertEqual('2026-01-02T03:04:05Z', result['timestamp'])
