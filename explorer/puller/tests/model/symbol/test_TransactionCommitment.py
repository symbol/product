from copy import deepcopy
from hashlib import sha3_256

import pytest
from symbolchain import sc
from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Merkle import MerklePart, prove_merkle
from symbolchain.symbol.Network import Network

from puller.model.symbol.Transaction import create_transaction_row
from puller.model.symbol.TransactionCommitment import UnboundAggregateReason, create_catbuffer_transaction, validate_transaction_commitments
from tests.facade.symbol.puller_test_utils import create_embedded_node_transaction, create_node_block, create_node_transaction
from tests.test.SymbolPublicChainCommitmentTestUtils import load_public_chain_commitments
from tests.test.SymbolTransactionCommitmentTestUtils import seal_block_transactions

UNBOUND_AGGREGATE_REASONS = {
	'aggregate_complete_v1': UnboundAggregateReason.UNMATCHED_V1_ROOT,
	'aggregate_complete_v2': UnboundAggregateReason.AMBIGUOUS_LEGACY_PAYLOAD_SIZE
}
LEGACY_MESSAGES = ('0041', '0042', '0043', '0044', '0045', '0046', '0047', '0048')
# Derived from CreateMerkleHashFromFiveHashes and CreateMerkleHashFromEightHashes in Core's InvalidMerkleHashBuilderTests.
INVALID_UNPADDED_FIVE_ROOT = '3ea90d77c31bf33e035997d23d2ef329dd8e04ae3878f92b208ad9eb44ec3b83'
INVALID_PADDED_EIGHT_ROOT = '8c00dc3e9724bb6da9cc24d6dbc1b9e08152bbe14d9a591eab70d91d46e47a39'


def _validate(items):
	rows = [create_transaction_row(item, Network.TESTNET, 0) for item in items]
	return validate_transaction_commitments(rows, Network.TESTNET.generation_hash_seed)


def _create_aggregate_with_messages(version, messages, cosigners=()):
	parent = create_node_transaction(5, type=sc.TransactionType.AGGREGATE_BONDED.value, version=version, cosignatures=[])
	del parent['transaction']['mosaics'], parent['transaction']['recipientAddress']
	children = [
		create_embedded_node_transaction(5, parent['meta']['hash'], index, message=message)
		for index, message in enumerate(messages)
	]
	seal_block_transactions(create_node_block(5), (parent, *children), cosigners=cosigners)
	return parent, children


def _create_aggregate(version=3, cosigners=()):
	parent, children = _create_aggregate_with_messages(version, ('0041',), cosigners)
	return parent, children[0]


def _replace_aggregate_root(parent, children, transactions_hash):
	parent['transaction']['transactionsHash'] = transactions_hash
	embedded = [create_catbuffer_transaction(child['transaction'], is_embedded=True) for child in children]
	transaction = create_catbuffer_transaction(parent['transaction'], embedded_transactions=embedded)
	entity_hash = str(SymbolFacade(Network.TESTNET).hash_transaction(transaction))
	parent['meta'].update(hash=entity_hash, merkleComponentHash=entity_hash)
	for child in children:
		child['meta']['aggregateHash'] = entity_hash


def _create_metadata_aggregate():
	parent, child = _create_aggregate()
	child['transaction'].update(
		type=sc.TransactionType.ACCOUNT_METADATA.value, targetAddress=child['transaction'].pop('recipientAddress'),
		scopedMetadataKey='1234567890ABCDEF', valueSizeDelta=-1, valueSize=2, value='3498')
	del child['transaction']['mosaics'], child['transaction']['message']
	seal_block_transactions(create_node_block(5), [parent, child])
	return parent, child


def _create_cosigned_aggregate():
	return _create_aggregate(cosigners=(KeyPair(PrivateKey('11' * 32)), KeyPair(PrivateKey('22' * 32))))


def _component_hashes(items):
	return {bytes.fromhex(item['meta']['hash']): bytes.fromhex(item['meta']['merkleComponentHash']) for item in items}


@pytest.mark.parametrize('name', tuple(load_public_chain_commitments()['transactions']))
def test_verifies_transaction_inclusion(name):
	# Arrange:
	fixtures = load_public_chain_commitments()
	case = fixtures['transactions'][name]
	node = fixtures['networks'][case['network']]['node']
	network = Network.MAINNET if 'mainnet' == case['network'] else Network.TESTNET
	seed = bytes.fromhex(node['networkGenerationHashSeed'])
	parent = case['transaction']
	rows = [create_transaction_row(item, network, 0) for item in (parent, *case['embeddedTransactions'])]
	entity_hash = bytes.fromhex(parent['meta']['hash'])
	expected_component = bytes.fromhex(parent['meta']['merkleComponentHash'])
	expected_unbound = {entity_hash: UNBOUND_AGGREGATE_REASONS[name]} if name in UNBOUND_AGGREGATE_REASONS else {}
	proof = [MerklePart(Hash256(step['hash']), 'left' == step['position']) for step in case['proof']['merklePath']]
	expected_root = Hash256(case['block']['block']['transactionsHash'])

	# Act:
	result = validate_transaction_commitments(rows, seed)

	# Assert:
	assert {entity_hash: expected_component} == result.component_hashes
	assert expected_unbound == result.unbound_aggregate_reasons
	assert prove_merkle(Hash256(result.component_hashes[entity_hash]), proof, expected_root)


def test_rejects_transfer_with_bad_seed():
	# Arrange:
	transfer = load_public_chain_commitments()['transactions']['transfer_with_message']['transaction']
	row = create_transaction_row(transfer, Network.MAINNET, 0)

	# Act:
	with pytest.raises(ValueError) as raised:
		validate_transaction_commitments([row], bytes(32))

	# Assert:
	assert 'Symbol transaction hash does not match reconstructed body' == str(raised.value)


@pytest.mark.parametrize(('field', 'value', 'message'), [
	('size', 177, 'size does not match reconstructed payload'),
	('network', 104, 'hash does not match reconstructed body'),
	('maxFee', '15', 'hash does not match reconstructed body'),
	('deadline', '15', 'hash does not match reconstructed body'),
	('mosaics', [{'id': '6BED913FA20223F8', 'amount': '42'}], 'hash does not match reconstructed body'),
	('signature', 'F1' * 64, 'hash does not match reconstructed body'),
	('network', True, 'expected a JSON integer'),
	('version', 11, 'unknown Transaction type'),
	('deadline', '１２', 'expected a base-10 uint64'),
	('mosaics', [{'id': '6BED913FA20223F8', 'amount': '42', 'uncommitted': 'value'}], 'expected a Symbol mosaic id and amount'),
	('signature', 'F ' * 64, 'expected hexadecimal bytes'),
	('extraField', 0, 'Unexpected Symbol transaction fields')
])
def test_rejects_changed_transfer_body(field, value, message):
	# Arrange:
	transfer = create_node_transaction(5)
	seal_block_transactions(create_node_block(5), [transfer])
	transfer['transaction'][field] = value

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([transfer])

	# Assert:
	assert message in str(raised.value)


@pytest.mark.parametrize('version', [1, 2, 3])
def test_accepts_separate_aggregate_rows(version):
	# Arrange:
	parent, child = _create_aggregate(version)

	# Act:
	result = _validate([child, parent])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {} == result.unbound_aggregate_reasons


@pytest.mark.parametrize(('version', 'messages'), [
	(1, ('0041', '0042', '0043')),
	(2, ('0041', '0042', '0043', '0043')),
	(2, ('0041', '0042', '0043', '0044', '0045', '0046', '0045', '0046'))
])
def test_reports_ambiguous_legacy_size(version, messages):
	# Arrange: Catapult pads odd Merkle levels by duplicating their last leaf or subtree.
	parent, children = _create_aggregate_with_messages(version, messages)
	parent_hash = bytes.fromhex(parent['meta']['hash'])

	# Act:
	result = _validate([parent, *children])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {parent_hash: UnboundAggregateReason.AMBIGUOUS_LEGACY_PAYLOAD_SIZE} == result.unbound_aggregate_reasons


@pytest.mark.parametrize(('version', 'messages'), [
	(2, ('0041', '0042', '0043', '0044')),
	(3, ('0041', '0042', '0043', '0043'))
])
def test_accepts_proven_aggregate_size(version, messages):
	# Arrange: V2's full distinct tail is unambiguous, and V3 commits to the size in the entity hash.
	parent, children = _create_aggregate_with_messages(version, messages)

	# Act:
	result = _validate([parent, *children])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {} == result.unbound_aggregate_reasons


@pytest.mark.parametrize(('count', 'transactions_hash'), [
	pytest.param(5, INVALID_UNPADDED_FIVE_ROOT, id='unpadded-five'),
	pytest.param(8, INVALID_PADDED_EIGHT_ROOT, id='padded-eight')
])
def test_reports_invalid_v1_merkle_tree(count, transactions_hash):
	# Arrange: Core's independent reference trees omit the last leaves in both cases.
	parent, children = _create_aggregate_with_messages(1, LEGACY_MESSAGES[:count])
	assert parent['transaction']['transactionsHash'].lower() != transactions_hash
	_replace_aggregate_root(parent, children, transactions_hash)
	parent_hash = bytes.fromhex(parent['meta']['hash'])

	# Act:
	result = _validate([parent, *children])
	children[-1]['transaction']['message'] = '0049'
	result_with_changed_tail = _validate([parent, *children])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {parent_hash: UnboundAggregateReason.INVALID_MERKLE_BUILDER} == result.unbound_aggregate_reasons
	assert result == result_with_changed_tail


def test_reports_unmatched_v1_root():
	# Arrange:
	parent, child = _create_aggregate(version=1)
	_replace_aggregate_root(parent, [child], 'AB' * 32)
	parent_hash = bytes.fromhex(parent['meta']['hash'])

	# Act:
	result = _validate([parent, child])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {parent_hash: UnboundAggregateReason.UNMATCHED_V1_ROOT} == result.unbound_aggregate_reasons


def test_rejects_v1_bad_component_hash():
	# Arrange:
	parent, child = _create_aggregate(version=1)
	_replace_aggregate_root(parent, [child], 'AB' * 32)
	parent['meta']['merkleComponentHash'] = 'CD' * 32

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert 'Symbol transaction Merkle component hash does not match reconstructed body' == str(raised.value)


@pytest.mark.parametrize('version', [2, 3])
def test_rejects_v2_and_v3_invalid_tree(version):
	# Arrange:
	parent, children = _create_aggregate_with_messages(version, LEGACY_MESSAGES[:5])
	_replace_aggregate_root(parent, children, INVALID_UNPADDED_FIVE_ROOT)

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, *children])

	# Assert:
	assert 'Symbol aggregate transaction Merkle root does not match embedded bodies' == str(raised.value)


def test_rejects_v3_changed_payload_size():
	# Arrange: The fourth leaf duplicates the implicit tail of a three-leaf tree.
	parent, children = _create_aggregate_with_messages(3, (*LEGACY_MESSAGES[:3], LEGACY_MESSAGES[2]))
	parent['transaction']['size'] -= 104  # One serialized 98-byte embedded transfer, padded to 8-byte alignment.

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, *children[:-1]])

	# Assert:
	assert 'Symbol transaction hash does not match reconstructed body' == str(raised.value)


def test_accepts_matching_inline_rows():
	# Arrange:
	parent, child = _create_aggregate()
	parent['transaction']['transactions'] = [deepcopy(child)]

	# Act:
	result = _validate([parent, child])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes


def test_rejects_mismatched_inline_rows():
	# Arrange:
	parent, child = _create_aggregate()
	parent['transaction']['transactions'] = [deepcopy(child)]
	parent['transaction']['transactions'][0]['transaction']['message'] = '0042'

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert 'Inline Symbol aggregate transactions do not match separate rows' == str(raised.value)


@pytest.mark.parametrize(('transactions', 'message'), [
	([{}], 'Malformed inline Symbol aggregate transaction'),
	({}, 'expected a JSON array')
])
def test_rejects_malformed_inline_rows(transactions, message):
	# Arrange:
	parent, child = _create_aggregate()
	parent['transaction']['transactions'] = transactions

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert message == str(raised.value)


def test_accepts_committed_metadata():
	# Arrange:
	parent, child = _create_metadata_aggregate()

	# Act:
	result = _validate([parent, child])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes


@pytest.mark.parametrize(('metadata_changes', 'message'), [
	({'value': '7890'}, 'Symbol aggregate transaction Merkle root does not match embedded bodies'),
	({'value': '7890', 'valueSize': 3}, 'Cannot reconstruct Symbol transaction type 16708 version 1: '
		'Symbol metadata valueSize differs from value bytes')
])
def test_rejects_changed_metadata_value(metadata_changes, message):
	# Arrange:
	parent, child = _create_metadata_aggregate()
	child['transaction'].update(metadata_changes)

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert message == str(raised.value)


def test_accepts_padded_v1_leaf():
	# Arrange:
	parent, child = _create_aggregate(version=1)
	embedded = create_catbuffer_transaction(child['transaction'], is_embedded=True)
	payload = embedded.serialize()
	padded_payload = payload + bytes(-len(payload) % 8)
	assert payload != padded_payload
	_replace_aggregate_root(parent, [child], sha3_256(padded_payload).hexdigest())

	# Act:
	result = _validate([parent, child])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes
	assert {} == result.unbound_aggregate_reasons


@pytest.mark.parametrize(('value', 'message'), [
	('absent', 'Missing or non-contiguous Symbol aggregate embedded transaction sources'),
	('gap', 'Missing or non-contiguous Symbol aggregate embedded transaction sources'),
	('duplicate', 'Duplicate Symbol aggregate embedded transaction source'),
	('orphan', 'Missing Symbol aggregate parent for embedded transaction commitment'),
	('non_aggregate', 'Embedded Symbol transaction has a non-aggregate parent'),
	('invalid_index', 'expected a JSON integer'),
	('duplicate_parent', 'Duplicate top-level Symbol transaction commitment')
])
def test_rejects_invalid_aggregate_links(value, message):
	# Arrange:
	parent, child = _create_aggregate()
	items = [parent, child]
	if 'absent' == value:
		items.remove(child)
	elif 'gap' == value:
		child['meta']['index'] = 1
	elif 'duplicate' == value:
		items.append(deepcopy(child))
	elif 'orphan' == value:
		items.remove(parent)
	elif 'non_aggregate' == value:
		parent['transaction'] = create_node_transaction(5)['transaction']
	elif 'invalid_index' == value:
		child['meta']['index'] = True
	else:
		items.append(deepcopy(parent))

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate(items)

	# Assert:
	assert message == str(raised.value)


def test_authenticates_cosignatures():
	# Arrange:
	parent, child = _create_cosigned_aggregate()

	# Act:
	result = _validate([parent, child])

	# Assert:
	assert _component_hashes([parent]) == result.component_hashes


def test_rejects_reordered_cosignatures():
	# Arrange:
	parent, child = _create_cosigned_aggregate()
	parent['transaction']['cosignatures'].reverse()

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert 'Symbol transaction Merkle component hash does not match reconstructed body' == str(raised.value)


@pytest.mark.parametrize(('cosignature_fields', 'message'), [
	({'version': '0', 'signature': 'AA' * 64}, 'Invalid Symbol aggregate cosignature'),
	({'version': '1', 'signature': 'AA' * 64}, 'Cannot reconstruct Symbol transaction type 16961 version 3: '
		'invalid Symbol aggregate cosignature version'),
	({'version': '1'}, 'Cannot reconstruct Symbol transaction type 16961 version 3: expected a Symbol aggregate cosignature')
])
def test_rejects_invalid_cosignatures(cosignature_fields, message):
	# Arrange:
	parent, child = _create_cosigned_aggregate()
	cosignatures = parent['transaction']['cosignatures']
	cosignatures[0] = {'signerPublicKey': cosignatures[0]['signerPublicKey'], **cosignature_fields}

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([parent, child])

	# Assert:
	assert message == str(raised.value)


def test_rejects_unsorted_mosaics():
	# Arrange:
	transfer = create_node_transaction(5, mosaics=[{'id': '1', 'amount': '10'}, {'id': '2', 'amount': '20'}])
	seal_block_transactions(create_node_block(5), [transfer])
	transfer['transaction']['mosaics'].reverse()

	# Act:
	with pytest.raises(ValueError) as raised:
		_validate([transfer])

	# Assert:
	assert str(raised.value).startswith('Cannot serialize Symbol TRANSFER transaction: ')


def test_reconstructs_hash_lock_mosaic():
	# Arrange:
	dto = create_node_transaction(5, type=sc.TransactionType.HASH_LOCK.value)['transaction']
	del dto['mosaics'], dto['recipientAddress']
	dto.update(hash='AB' * 32, duration='480', mosaicId='6BED913FA20223F8', amount=10)

	# Act:
	transaction = create_catbuffer_transaction(dto)

	# Assert:
	assert (0x6BED913FA20223F8, 10) == (transaction.mosaic.mosaic_id.value, transaction.mosaic.amount.value)


@pytest.mark.parametrize('mosaic_id', [pytest.param(1, id='json-number'), pytest.param('', id='empty-text')])
def test_rejects_invalid_hex_mosaic_id(mosaic_id):
	# Arrange:
	dto = create_node_transaction(5, mosaics=[{'id': mosaic_id, 'amount': '42'}])['transaction']

	# Act:
	with pytest.raises(ValueError) as raised:
		create_catbuffer_transaction(dto)

	# Assert:
	assert (
		f'Cannot reconstruct Symbol transaction type {sc.TransactionType.TRANSFER.value} version 1: expected a base-16 uint64'
	) == str(raised.value)


@pytest.mark.parametrize('amount', [
	pytest.param('18446744073709551616', id='decimal-text-overflow'),
	pytest.param(1 << 64, id='json-integer-overflow'),
	pytest.param(-1, id='negative-json-integer')
])
def test_rejects_out_of_range_amount(amount):
	# Arrange:
	dto = create_node_transaction(5, mosaics=[{'id': '1', 'amount': amount}])['transaction']

	# Act:
	with pytest.raises(ValueError) as raised:
		create_catbuffer_transaction(dto)

	# Assert:
	assert (
		f'Cannot reconstruct Symbol transaction type {sc.TransactionType.TRANSFER.value} version 1: expected a base-10 uint64'
	) == str(raised.value)


def test_reconstructs_restriction_array():
	# Arrange:
	dto = create_node_transaction(5, type=sc.TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value)['transaction']
	del dto['mosaics'], dto['recipientAddress']
	dto.update(restrictionFlags=2, restrictionAdditions=['6BED913FA20223F8'], restrictionDeletions=['1234'])

	# Act:
	transaction = create_catbuffer_transaction(dto)

	# Assert:
	assert [sc.UnresolvedMosaicId(0x6BED913FA20223F8)] == transaction.restriction_additions
	assert [sc.UnresolvedMosaicId(0x1234)] == transaction.restriction_deletions


@pytest.mark.parametrize(('dto', 'message'), [
	([], 'Malformed Symbol transaction body'),
	({'type': sc.TransactionType.TRANSFER.value}, 'Cannot reconstruct Symbol transaction')
])
def test_rejects_invalid_transaction(dto, message):
	# Act:
	with pytest.raises(ValueError) as raised:
		create_catbuffer_transaction(dto)

	# Assert:
	assert message in str(raised.value)


@pytest.mark.parametrize('is_root', [False, True])
def test_reconstructs_namespace_variants(is_root):
	# Arrange:
	dto = {
		'type': sc.TransactionType.NAMESPACE_REGISTRATION.value, 'version': 1, 'network': Network.TESTNET.identifier,
		'signerPublicKey': 'AD' * 32, 'registrationType': 0 if is_root else 1, 'id': 'D0123456789ABCDE', 'name': 'namespace-name',
		**({'duration': '1000'} if is_root else {'parentId': 'E123456789ABCDEF'})
	}

	# Act:
	reconstructed = create_catbuffer_transaction(dto, is_embedded=True)

	# Assert:
	assert (b'namespace-name', 0xD0123456789ABCDE) == (reconstructed.name, reconstructed.id.value)
	assert (1000 if is_root else 0) == reconstructed.duration.value
	assert (None if is_root else sc.NamespaceId(0xE123456789ABCDEF)) == reconstructed.parent_id


def test_rejects_nonascii_namespace():
	# Arrange:
	dto = {
		'type': sc.TransactionType.NAMESPACE_REGISTRATION.value, 'version': 1, 'network': Network.TESTNET.identifier,
		'signerPublicKey': 'AD' * 32, 'registrationType': 0, 'id': 'D0123456789ABCDE', 'name': '名前', 'duration': '1000'
	}

	# Act:
	with pytest.raises(ValueError) as raised:
		create_catbuffer_transaction(dto, is_embedded=True)

	# Assert:
	assert 'Cannot reconstruct Symbol transaction type 16718 version 1: expected an ASCII namespace name' == str(raised.value)
