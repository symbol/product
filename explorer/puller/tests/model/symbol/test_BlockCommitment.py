# pylint: disable=invalid-name

import pytest
from symbolchain.sc import BlockType, NetworkType

from puller.model.symbol.BlockCommitment import validate_block_commitment
from tests.test.SymbolBlockCommitmentTestUtils import commit_node_block
from tests.test.SymbolPublicChainCommitmentTestUtils import load_public_chain_commitments


def _block_fixture(block_type):
	body = {
		'size': 776,
		'version': 1,
		'network': NetworkType.MAINNET.value,
		'type': block_type.value,
		'signature': 'AB' * 32 + 'CD' * 32,
		'signerPublicKey': '21' * 32,
		'height': '1' if BlockType.NEMESIS == block_type else '4294967301',
		'timestamp': '18446744073709551615',
		'difficulty': '100000000000000',
		'proofGamma': 'BA' * 32,
		'proofVerificationHash': 'ED' * 16,
		'proofScalar': '01' * 32,
		'previousBlockHash': '00' * 32 if BlockType.NEMESIS == block_type else '31' * 32,
		'transactionsHash': '42' * 32,
		'receiptsHash': '53' * 32,
		'stateHash': '68' * 32,
		'beneficiaryAddress': '68' + '69' * 23,
		'feeMultiplier': 4097
	}
	if BlockType.NORMAL != block_type:
		body.update({
			'votingEligibleAccountsCount': 65537,
			'harvestingEligibleAccountsCount': '4294967311',
			'totalVotingBalance': '18446744073709551600',
			'previousImportanceBlockHash': '76' * 32
		})

	return commit_node_block({'meta': {}, 'block': body})


@pytest.mark.parametrize('block_type', [BlockType.NORMAL, BlockType.IMPORTANCE, BlockType.NEMESIS])
def test_validate_block_commitment_matches_sdk_serialized_headers(block_type):
	# Arrange:
	item = _block_fixture(block_type)
	expected = bytes.fromhex(item['meta']['hash'])
	item['meta']['hash'] = item['meta']['hash'].lower()

	# Act:
	result = validate_block_commitment(item)

	# Assert:
	assert expected == result


def test_validate_block_commitment_matches_core_testnet_nemesis_block_hash():
	# Arrange: Core testnet seed/00000/00001.dat as a REST header, with the hash from seed/testnet/00000/hashes.dat.
	expected = '3A71AFC15705D718FFDE7E2BD4134EF1E9E5417CD39100EA4DC15FBEEA4BFB6F'
	item = {
		'meta': {'hash': expected},
		'block': {
			'size': 7697,
			'signature': (
				'C1A78852D91A4BF94C9A4D654B6F0568913F1DC437FCB224B807429E105B78B9C'
				'D2B3F6BF54E50176AC9405C399237A3CC4AA150E4E4D9A093A8835EB30DFA04'
			),
			'signerPublicKey': 'C67F465087EF681824805B7E9FF3B2728A4EE847DE044DE5D9FA415F7660B08E',
			'version': 1,
			'network': 152,
			'type': 32835,
			'height': '1',
			'timestamp': '0',
			'difficulty': '100000000000000',
			'proofGamma': '8D49594A96C31EC6C64305FB2CCB47AA7A4AC0A4F614442BB3684D2BF41F274E',
			'proofVerificationHash': '82FB583BFE3EE78805784D078F2547AE',
			'proofScalar': '480175C83739B22C53EAECAA7E7F3B245F1DFAFA6B3AE5C1D0129502FCBAAD0C',
			'previousBlockHash': '00' * 32,
			'transactionsHash': '5507AC9077A460E55E7AE6486EAD07A46B86A956AA5CC585A272B31F99F4D16B',
			'receiptsHash': '00' * 32,
			'stateHash': '00' * 32,
			'beneficiaryAddress': '9822D031CAFB3993B57FEE5ADC0BD4033A431FBFA138812A',
			'feeMultiplier': 0,
			'votingEligibleAccountsCount': 0,
			'harvestingEligibleAccountsCount': '11',
			'totalVotingBalance': '0',
			'previousImportanceBlockHash': '00' * 32
		}
	}

	# Act:
	result = validate_block_commitment(item)

	# Assert:
	assert bytes.fromhex(expected) == result


@pytest.mark.parametrize(('field_name', 'new_value'), [
	('signature', 'AB' * 32 + 'EF' * 32),
	('signerPublicKey', '12' * 32),
	('network', NetworkType.TESTNET.value),
	('height', '4294967302'),
	('timestamp', '18446744073709551614'),
	('difficulty', '100000000000001'),
	('proofGamma', 'BB' * 32),
	('proofVerificationHash', 'EE' * 16),
	('proofScalar', '02' * 32),
	('previousBlockHash', '13' * 32),
	('transactionsHash', '24' * 32),
	('receiptsHash', '35' * 32),
	('stateHash', '86' * 32),
	('beneficiaryAddress', '68' + '96' * 23),
	('feeMultiplier', 4098),
	('votingEligibleAccountsCount', 65538),
	('harvestingEligibleAccountsCount', '4294967312'),
	('totalVotingBalance', '18446744073709551601'),
	('previousImportanceBlockHash', '67' * 32)
])
def test_validate_block_commitment_rejects_changes_to_committed_fields(field_name, new_value):
	# Arrange:
	item = _block_fixture(BlockType.IMPORTANCE)
	item['block'][field_name] = new_value

	# Act:
	with pytest.raises(ValueError) as raised:
		validate_block_commitment(item)

	# Assert:
	assert 'Symbol block hash does not match reconstructed header' == str(raised.value)


def test_validate_block_commitment_excludes_reported_size_and_non_hash_metadata():
	# Arrange: the size includes transactions beyond the header, and generationHash is independent metadata.
	item = _block_fixture(BlockType.NORMAL)
	expected = bytes.fromhex(item['meta']['hash'])
	item['block']['size'] = 376
	item['meta']['generationHash'] = '88' * 32

	# Act:
	result = validate_block_commitment(item)

	# Assert:
	assert expected == result


@pytest.mark.parametrize('item', [None, [], {}, {'block': []}])
def test_validate_block_commitment_requires_rest_block_wrapper(item):
	# Act:
	with pytest.raises(ValueError) as raised:
		validate_block_commitment(item)

	# Assert:
	assert 'Malformed Symbol block commitment' == str(raised.value)


@pytest.mark.parametrize('meta', [None, [], {}, {'hash': '00' * 31}, {'hash': 'G0' * 32}])
def test_validate_block_commitment_requires_a_32_byte_reported_hash(meta):
	# Arrange:
	item = _block_fixture(BlockType.NORMAL)
	item['meta'] = meta

	# Act:
	with pytest.raises(ValueError) as raised:
		validate_block_commitment(item)

	# Assert:
	assert 'Invalid Symbol block commitment hash' == str(raised.value)


@pytest.mark.parametrize(('block_type', 'field_name', 'value', 'message'), [
	(BlockType.NORMAL, 'type', '33091', 'Unsupported Symbol block header type'),
	(BlockType.NORMAL, 'type', 0, 'Unsupported Symbol block header type'),
	(BlockType.NORMAL, 'version', 2, 'Unsupported Symbol block header version'),
	(BlockType.NORMAL, 'version', True, 'Invalid Symbol block header version'),
	(BlockType.NORMAL, 'network', 0, 'Unsupported Symbol block header network'),
	(BlockType.NORMAL, 'height', '0', 'Unexpected Symbol block type at header height'),
	(BlockType.NORMAL, 'height', '1', 'Unexpected Symbol block type at header height'),
	(BlockType.NEMESIS, 'height', '2', 'Unexpected Symbol block type at header height'),
	(BlockType.NORMAL, 'height', 2, 'Invalid Symbol block header height'),
	(BlockType.NORMAL, 'timestamp', '\u0661', 'Invalid Symbol block header timestamp'),
	(BlockType.NORMAL, 'difficulty', '18446744073709551616', 'Invalid Symbol block header difficulty'),
	(BlockType.NORMAL, 'difficulty', '0' * 21, 'Invalid Symbol block header difficulty'),
	(BlockType.NORMAL, 'size', 375, 'Symbol block size is smaller than its header'),
	(BlockType.NEMESIS, 'size', 423, 'Symbol block size is smaller than its header'),
	(BlockType.NORMAL, 'signature', 'AB' * 63, 'Invalid Symbol block header signature'),
	(BlockType.NORMAL, 'proofGamma', None, 'Invalid Symbol block header proofGamma'),
	(BlockType.NORMAL, 'proofVerificationHash', 'GG' * 16, 'Invalid Symbol block header proofVerificationHash'),
	(BlockType.NORMAL, 'beneficiaryAddress', 'AB' * 25, 'Invalid Symbol block header beneficiaryAddress'),
	(BlockType.NORMAL, 'feeMultiplier', 1 << 32, 'Invalid Symbol block header feeMultiplier'),
	(BlockType.IMPORTANCE, 'votingEligibleAccountsCount', -1, 'Invalid Symbol block header votingEligibleAccountsCount')
])
def test_validate_block_commitment_rejects_malformed_fields(block_type, field_name, value, message):
	# Arrange:
	item = _block_fixture(block_type)
	item['block'][field_name] = value

	# Act:
	with pytest.raises(ValueError) as raised:
		validate_block_commitment(item)

	# Assert:
	assert message == str(raised.value)


@pytest.mark.parametrize(('block_type', 'missing_field', 'unexpected_field'), [
	(BlockType.NORMAL, 'proofScalar', None),
	(BlockType.NORMAL, None, 'totalVotingBalance'),
	(BlockType.IMPORTANCE, 'previousImportanceBlockHash', None),
	(BlockType.NEMESIS, None, 'blockHeaderReserved1')
])
def test_validate_block_commitment_requires_the_block_type_layout(block_type, missing_field, unexpected_field):
	# Arrange:
	item = _block_fixture(block_type)
	if missing_field:
		del item['block'][missing_field]

	if unexpected_field:
		item['block'][unexpected_field] = 0

	# Act:
	with pytest.raises(ValueError) as raised:
		validate_block_commitment(item)

	# Assert:
	assert 'Malformed Symbol block header fields' == str(raised.value)


@pytest.mark.parametrize('height', tuple(load_public_chain_commitments()['receipts']))
def test_reconstructs_block_header_hash(height):
	# Arrange:
	block = load_public_chain_commitments()['receipts'][height]['block']
	expected_hash = bytes.fromhex(block['meta']['hash'])

	# Act:
	result = validate_block_commitment(block)

	# Assert:
	assert expected_hash == result
