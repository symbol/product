# pylint: disable=duplicate-code
from datetime import datetime, timezone
from unittest import TestCase

from psycopg2.extras import Json
from symbolchain.sc import BlockType
from symbolchain.symbol.Network import Network

from puller.model.symbol.Block import create_block_row

SIGNER_PUBLIC_KEY = '76E94661562762111FF7E592B00398554973396D8A4B922F3E3D139892F7C35C'
SIGNER_ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'
BENEFICIARY_ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'


def _create_node_block(height, **block_overrides):
	node_block = {
		'meta': {
			'hash': f'{height:064X}',
			'totalFee': str(height * 1000),
			'totalTransactionsCount': height + 10,
			'transactionsCount': height,
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
		'transactions_count': height,
		'total_transactions_count': height + 10,
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
	def test_create_block_row_populates_fields(self):
		# Arrange:
		node_block = _create_node_block(7)

		# Act:
		row = create_block_row(node_block, 100, Network.TESTNET)

		# Assert:
		self.assertEqual(_expected_block_row(node_block, 7), _to_plain_dict(row))

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

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol block type 1'):
			create_block_row(node_block, 100, Network.TESTNET)
