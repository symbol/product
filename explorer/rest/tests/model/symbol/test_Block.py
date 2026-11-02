from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo

from rest.db.SymbolDatabase import BlockStatisticsRecord
from rest.model.symbol.Block import SymbolBlockStatisticsView, SymbolBlockView


def _expected_list_dict():
	return {
		'height': 2,
		'hash': '01',
		'previousHash': '02',
		'timestamp': '2026-01-02 03:04:05',
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
	NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)

	@staticmethod
	def _create_block_view():
		return SymbolBlockView(
			height=2,
			block_hash=b'\x01',
			previous_hash=b'\x02',
			timestamp=datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc),
			network_timestamp=1234,
			total_fee=Decimal('1234567'),
			block_reward=None,
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
		result = block_view.to_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual(_expected_list_dict(), result)

	def test_can_convert_to_detail_dict(self):
		# Arrange:
		block_view = self._create_block_view()

		# Act:
		result = block_view.to_detail_dict(self.NATIVE_MOSAIC_INFO)

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
			'totalVotingBalance': 19000235.663367,
			'previousImportanceBlockHash': '0A',
			'blockType': 'nemesis'
		}, result)

	def test_can_format_zero_total_voting_balance_as_zero_native_units(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.total_voting_balance = 0

		# Act:
		result = block_view.to_detail_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual(0.0, result['totalVotingBalance'])

	def test_can_format_none_total_voting_balance_as_none(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.total_voting_balance = None

		# Act:
		result = block_view.to_detail_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertIsNone(result['totalVotingBalance'])

	def test_can_format_total_voting_balance_using_native_divisibility(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.total_voting_balance = Decimal('123456')
		native_mosaic_info = NativeMosaicInfo('72C0212E67A08BCE', 3)

		# Act:
		result = block_view.to_detail_dict(native_mosaic_info)

		# Assert:
		self.assertEqual(123.456, result['totalVotingBalance'])

	def test_can_convert_empty_state_hash_sub_cache_roots(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.state_hash_sub_cache_roots = []

		# Act:
		result = block_view.to_detail_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual([], result['stateHashSubCacheMerkleRoots'])

	def test_can_format_naive_datetime_as_utc(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.timestamp = datetime(2026, 1, 2, 3, 4, 5)

		# Act:
		result = block_view.to_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual('2026-01-02 03:04:05', result['timestamp'])

	def test_can_format_zero_block_reward_as_zero_native_units(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.block_reward = 0

		# Act + Assert:
		self.assertEqual(0.0, block_view.to_dict(self.NATIVE_MOSAIC_INFO)['blockReward'])

	def test_can_format_positive_block_reward_using_native_divisibility(self):
		# Arrange:
		block_view = self._create_block_view()
		block_view.block_reward = Decimal('1234567')

		# Act + Assert:
		self.assertEqual(1.234567, block_view.to_dict(self.NATIVE_MOSAIC_INFO)['blockReward'])


class SymbolBlockStatisticsViewTest(TestCase):
	NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 2)

	def test_formats_charts_and_scalars_from_ascending_rows(self):
		# Arrange:
		blocks = [
			BlockStatisticsRecord(10, datetime(2026, 1, 1, tzinfo=timezone.utc), 100, 10 ** 12),
			BlockStatisticsRecord(11, datetime(2026, 1, 1, 0, 0, 30, 123000, tzinfo=timezone.utc), 0, 12345000000000),
			BlockStatisticsRecord(12, datetime(2026, 1, 1, 0, 1, 1, 123000, tzinfo=timezone.utc), 300, 12350000000000)
		]

		# Act:
		result = SymbolBlockStatisticsView(blocks).to_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'blockTimeChart': [[11, 30.123], [12, 31.0]],
			'blockFeeChart': [[10, 1.0], [11, 0.0], [12, 3.0]],
			'blockDifficultyChart': [[10, '1.00'], [11, '12.35'], [12, '12.35']],
			'blockTime': 31,
			'blockFee': 1.3333333333333333,
			'blockDifficulty': '12.35'
		}, result)

	def test_formats_single_genesis_with_empty_time_statistics(self):
		# Arrange:
		block = BlockStatisticsRecord(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 0, 0)

		# Act:
		result = SymbolBlockStatisticsView([block]).to_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual([], result['blockTimeChart'])
		self.assertIsNone(result['blockTime'])
		self.assertEqual([[1, 0.0]], result['blockFeeChart'])
		self.assertEqual(0.0, result['blockFee'])
		self.assertEqual([[1, '0.00']], result['blockDifficultyChart'])
		self.assertEqual('0.00', result['blockDifficulty'])

	def test_formats_difficulty_like_frontend_at_rounding_boundaries(self):
		# Arrange:
		for difficulty, expected_difficulty in ((12045000000000, '12.04'), (1005000000000, '1.00')):
			with self.subTest(difficulty=difficulty):
				block = BlockStatisticsRecord(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 0, difficulty)

				# Act:
				result = SymbolBlockStatisticsView([block]).to_dict(self.NATIVE_MOSAIC_INFO)

				# Assert:
				self.assertEqual({
					'blockTimeChart': [],
					'blockFeeChart': [[1, 0.0]],
					'blockDifficultyChart': [[1, expected_difficulty]],
					'blockTime': None,
					'blockFee': 0.0,
					'blockDifficulty': expected_difficulty
				}, result)

	def test_rounds_half_second_average_up(self):
		# Arrange:
		base_timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
		blocks = [
			BlockStatisticsRecord(10, base_timestamp, 100, 10 ** 12),
			BlockStatisticsRecord(11, base_timestamp + timedelta(seconds=30), 200, 2 * 10 ** 12),
			BlockStatisticsRecord(12, base_timestamp + timedelta(seconds=61), 300, 3 * 10 ** 12)
		]

		# Act:
		result = SymbolBlockStatisticsView(blocks).to_dict(self.NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'blockTimeChart': [[11, 30.0], [12, 31.0]],
			'blockFeeChart': [[10, 1.0], [11, 2.0], [12, 3.0]],
			'blockDifficultyChart': [[10, '1.00'], [11, '2.00'], [12, '3.00']],
			'blockTime': 31,
			'blockFee': 2.0,
			'blockDifficulty': '3.00'
		}, result)

	def test_formats_240_chart_points_from_241_records_in_ascending_order(self):
		# Arrange:
		base_timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
		blocks = []
		timestamp = base_timestamp
		for height in range(2, 243):
			blocks.append(BlockStatisticsRecord(height, timestamp, height * 1000000, height * 10 ** 12))
			timestamp += timedelta(seconds=10 + ((height + 1) % 3))

		# Act:
		result = SymbolBlockStatisticsView(blocks).to_dict(NativeMosaicInfo('72C0212E67A08BCE', 6))

		# Assert:
		self.assertEqual(240, len(result['blockTimeChart']))
		self.assertEqual(240, len(result['blockFeeChart']))
		self.assertEqual(240, len(result['blockDifficultyChart']))
		self.assertEqual([3, 10.0], result['blockTimeChart'][0])
		self.assertEqual([242, 12.0], result['blockTimeChart'][-1])
		self.assertEqual([3, 3.0], result['blockFeeChart'][0])
		self.assertEqual([242, 242.0], result['blockFeeChart'][-1])
		self.assertEqual([3, '3.00'], result['blockDifficultyChart'][0])
		self.assertEqual([242, '242.00'], result['blockDifficultyChart'][-1])
		self.assertEqual(11, result['blockTime'])
		self.assertEqual(122.5, result['blockFee'])
		self.assertEqual('242.00', result['blockDifficulty'])
