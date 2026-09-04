# pylint: disable=duplicate-code
from datetime import datetime, timezone
from unittest import TestCase

from psycopg2.extras import Json
from symbolchain.sc import BlockType
from symbolchain.symbol.Network import Network

from puller.model.symbol.Block import create_block_row
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, SIGNER_ADDRESS, SIGNER_PUBLIC_KEY

MAX_INT4 = 2147483647


def _create_node_block(height, transactions_count=0, total_transactions_count=0, **block_overrides):
	node_block = {
		'meta': {
			'hash': f'{height:064X}',
			'totalFee': str(height * 1000),
			'totalTransactionsCount': total_transactions_count,
			'transactionsCount': transactions_count,
			'statementsCount': height + 1,
			'stateHashSubCacheMerkleRoots': ['A' * 64]
		},
		'block': {
			'size': 100 + height,
			'signature': '1' * 128,
			'signerPublicKey': SIGNER_PUBLIC_KEY,
			'version': 1,
			'network': 152,
			'type': BlockType.NEMESIS.value,
			'height': str(height),
			'timestamp': str(height * 1000),
			'difficulty': str(100000 + height),
			'proofGamma': '2' * 64,
			'proofVerificationHash': '3' * 32,
			'proofScalar': '4' * 64,
			'previousBlockHash': f'{height - 1:064X}',
			'transactionsHash': '5' * 64,
			'receiptsHash': '6' * 64,
			'stateHash': '7' * 64,
			'beneficiaryAddress': BENEFICIARY_ADDRESS,
			'feeMultiplier': height
		},
		'id': str(height)
	}
	node_block['block'].update(block_overrides)

	return node_block


def _to_plain_dict(row):
	return {
		key: value.adapted if isinstance(value, Json) else value
		for key, value in row.items()
	}


def _expected_block_row(node_block, height, **overrides):
	expected = {
		'height': height,
		'hash': bytes.fromhex(f'{height:064X}'),
		'previous_hash': bytes.fromhex(f'{height - 1:064X}'),
		'timestamp': datetime.fromtimestamp(100 + height, timezone.utc),
		'network_timestamp': height * 1000,
		'total_fee': height * 1000,
		'transactions_count': 0,
		'total_transactions_count': 0,
		'statements_count': height + 1,
		'difficulty': 100000 + height,
		'fee_multiplier': height,
		'block_type': 'nemesis',
		'signer_public_key': bytes.fromhex(SIGNER_PUBLIC_KEY),
		'signer_address': bytes.fromhex(SIGNER_ADDRESS),
		'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
		'signature': bytes.fromhex('1' * 128),
		'size': 100 + height,
		'proof_gamma': bytes.fromhex('2' * 64),
		'proof_verification_hash': bytes.fromhex('3' * 32),
		'proof_scalar': bytes.fromhex('4' * 64),
		'state_hash': bytes.fromhex('7' * 64),
		'transactions_hash': bytes.fromhex('5' * 64),
		'receipts_hash': bytes.fromhex('6' * 64),
		'state_hash_sub_cache_roots': ['A' * 64],
		'voting_eligible_accounts_count': None,
		'harvesting_eligible_accounts_count': None,
		'total_voting_balance': None,
		'previous_importance_block_hash': None,
		'raw_payload': node_block
	}
	expected.update(overrides)

	return expected


class BlockTest(TestCase):
	def _assert_rejects_transaction_counts(self, transactions_count, total_transactions_count, error_message):
		# Arrange:
		node_block = _create_node_block(
			7,
			transactions_count=transactions_count,
			total_transactions_count=total_transactions_count)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, error_message):
			create_block_row(node_block, 100, Network.TESTNET)

	def test_create_block_row_populates_fields(self):
		# Arrange:
		node_block = _create_node_block(7, transactions_count=7, total_transactions_count=17)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(
			_expected_block_row(node_block, 7, transactions_count=7, total_transactions_count=17),
			_to_plain_dict(row))

	def test_create_block_row_populates_importance_block_fields(self):
		# Arrange:
		node_block = _create_node_block(
			7,
			type=BlockType.IMPORTANCE.value,
			votingEligibleAccountsCount='4',
			harvestingEligibleAccountsCount='17',
			totalVotingBalance='19000235663367',
			previousImportanceBlockHash='86' * 32
		)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(4, row['voting_eligible_accounts_count'])
		self.assertEqual(17, row['harvesting_eligible_accounts_count'])
		self.assertEqual(19000235663367, row['total_voting_balance'])
		self.assertEqual(bytes.fromhex('86' * 32), row['previous_importance_block_hash'])
		self.assertEqual('importance', row['block_type'])

	def test_create_block_row_allows_missing_importance_block_fields(self):
		# Arrange:
		node_block = _create_node_block(7)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertIsNone(row['voting_eligible_accounts_count'])
		self.assertIsNone(row['harvesting_eligible_accounts_count'])
		self.assertIsNone(row['total_voting_balance'])
		self.assertIsNone(row['previous_importance_block_hash'])

	def test_create_block_row_rejects_unknown_block_type(self):
		# Arrange:
		node_block = _create_node_block(1, type=1)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol block type 1'):
			create_block_row(node_block, 100, Network.TESTNET)

	def test_create_block_row_rejects_non_numeric_block_type(self):
		# Arrange:
		node_block = _create_node_block(1, type='invalid')

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol block type invalid'):
			create_block_row(node_block, 100, Network.TESTNET)

	def test_create_block_row_accepts_zero_transaction_counts(self):
		# Arrange:
		node_block = _create_node_block(7, transactions_count=0, total_transactions_count=0)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(0, row['transactions_count'])
		self.assertEqual(0, row['total_transactions_count'])

	def test_create_block_row_accepts_equal_positive_transaction_counts(self):
		# Arrange:
		node_block = _create_node_block(7, transactions_count=7, total_transactions_count=7)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(7, row['transactions_count'])
		self.assertEqual(7, row['total_transactions_count'])

	def test_create_block_row_accepts_int4_maximum_transaction_counts(self):
		# Arrange:
		node_block = _create_node_block(7, transactions_count=MAX_INT4, total_transactions_count=MAX_INT4)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(MAX_INT4, row['transactions_count'])
		self.assertEqual(MAX_INT4, row['total_transactions_count'])

	def test_create_block_row_rejects_missing_transactions_count(self):
		# Arrange:
		node_block = _create_node_block(7)
		del node_block['meta']['transactionsCount']

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Missing Symbol block transactionsCount'):
			create_block_row(node_block, 100, Network.TESTNET)

	def test_create_block_row_rejects_missing_total_transactions_count(self):
		# Arrange:
		node_block = _create_node_block(7)
		del node_block['meta']['totalTransactionsCount']

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Missing Symbol block totalTransactionsCount'):
			create_block_row(node_block, 100, Network.TESTNET)

	def test_create_block_row_rejects_invalid_transactions_count(self):
		for value in (True, 1.0, '1', -1, MAX_INT4 + 1):
			with self.subTest(value=value):
				self._assert_rejects_transaction_counts(value, 1, 'Invalid Symbol block transactionsCount')

	def test_create_block_row_rejects_invalid_total_transactions_count(self):
		for value in (True, 1.0, '1', -1, MAX_INT4 + 1):
			with self.subTest(value=value):
				self._assert_rejects_transaction_counts(0, value, 'Invalid Symbol block totalTransactionsCount')

	def test_create_block_row_rejects_transactions_count_greater_than_total(self):
		self._assert_rejects_transaction_counts(
			2,
			1,
			'Symbol block transactionsCount exceeds totalTransactionsCount')
