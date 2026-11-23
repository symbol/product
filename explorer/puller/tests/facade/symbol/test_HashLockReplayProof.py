import pytest
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import ReceiptType, TransactionType
from symbolchain.symbol.Network import Network

from puller.facade.ForkReconciliation import RecoveryStopped
from puller.facade.HashLockReplayProof import HashLockReplayProof
from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason
from puller.model.symbol.Lock import create_hash_lock_key
from puller.model.symbol.Receipt import create_receipt_rows
from puller.model.symbol.Transaction import create_transaction_row
from tests.test.SymbolTestConstants import SIGNER_ADDRESS

from .puller_test_utils import NATIVE_MOSAIC_ID, create_amount_statement_item, create_node_transaction

LOCK_HASH = 'AB' * 32
KEY = create_hash_lock_key(LOCK_HASH)
OWNER = bytes.fromhex(SIGNER_ADDRESS)
BASELINE = (KEY, OWNER, NATIVE_MOSAIC_ID, 1234, 12, 'unused')


def _creation(height, index=0, **fields):
	transaction = create_node_transaction(height, block_index=index, **{
		'type': TransactionType.HASH_LOCK.value, 'hash': LOCK_HASH,
		'mosaicId': NATIVE_MOSAIC_ID, 'amount': '1234', 'duration': '5', **fields
	})
	return create_transaction_row(transaction, Network.TESTNET, 100)


def _completion(height):
	transaction = create_node_transaction(height, transaction_hash=LOCK_HASH, type=TransactionType.AGGREGATE_BONDED.value)
	return create_transaction_row(transaction, Network.TESTNET, 100)


def _receipt(height, receipt_type=ReceiptType.LOCK_HASH_CREATED, index=0, owner=SIGNER_ADDRESS, amount=1234):
	item = create_amount_statement_item(height, amount, receipt_type=receipt_type.value, targetAddress=owner)
	item['statement']['source']['primaryId'] = index + 1
	return create_receipt_rows(item)[0]


def test_state_at_height_after_key_reuse():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	next_owner_key = '34' * 32
	next_owner = Network.TESTNET.public_key_to_address(PublicKey(next_owner_key)).bytes
	reused = _creation(8, index=1, signerPublicKey=next_owner_key, duration=9, amount='2468')
	completed = _receipt(8, ReceiptType.LOCK_HASH_COMPLETED)
	recreated = _receipt(8, index=1, owner=next_owner.hex().upper(), amount=2468)

	# Act: the transaction response can return same-height entries in reverse index order.
	proof.apply_page({7: [_creation(7)], 8: [reused, _completion(8)]}, {7: [_receipt(7)], 8: [recreated, completed]})

	# Assert:
	assert not proof.states_at(6)
	assert {KEY} == proof.prunable_at(6)
	assert {BASELINE} == proof.states_at(7)
	assert not proof.prunable_at(7)
	assert {(KEY, next_owner, NATIVE_MOSAIC_ID, 2468, 17, 'unused')} == proof.states_at(8)


def test_prunes_only_to_cutoff():
	# Arrange: H7 expires at H12 before the same key is reused at H13.
	proof = HashLockReplayProof({KEY}, (), {KEY}, {KEY: 0})
	amount = 10_000_000
	proof.apply_page(
		{height: [_creation(height, amount=str(amount))] for height in (7, 13)},
		{height: [_receipt(height, amount=amount)] for height in (7, 13)})

	# Act / Assert:
	assert {KEY} == proof.prunable_at(12, 12)
	assert not proof.prunable_at(13, 12)


def test_ignores_unrelated_transactions():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (BASELINE,), ())
	transfer = create_transaction_row(create_node_transaction(8, block_index=1), Network.TESTNET, 100)
	unrelated_creation = _creation(8, hash='CD' * 32)

	# Act:
	proof.apply_page({8: [transfer, unrelated_creation]}, {})

	# Assert:
	assert {BASELINE} == proof.states_at(8)


@pytest.mark.parametrize('duration', [None, '0', str(1 << 64), True])
def test_rejects_invalid_end_height(duration):
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})

	# Act:
	with pytest.raises(RecoveryStopped, match='duration cannot be proven') as caught:
		proof.apply_page({7: [_creation(7, duration=duration)]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


@pytest.mark.parametrize('mosaic_override', [{'mosaicId': 'AB' * 8}, {'amount': '0'}])
def test_requires_mosaic_and_amount(mosaic_override):
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})

	# Act:
	with pytest.raises(RecoveryStopped, match='mosaic cannot be proven') as caught:
		proof.apply_page({7: [_creation(7, **mosaic_override)]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_requires_mosaic_relation():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	transaction = _creation(7)
	transaction['mosaic_rows'].clear()

	# Act:
	with pytest.raises(RecoveryStopped, match='mosaic cannot be proven') as caught:
		proof.apply_page({7: [transaction]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_rejects_duplicate_source_index():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	transfer = create_transaction_row(create_node_transaction(7, transaction_hash='CD' * 32), Network.TESTNET, 100)

	# Act:
	with pytest.raises(RecoveryStopped, match='transaction source is missing or ambiguous') as caught:
		proof.apply_page({7: [_creation(7), transfer]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_requires_matching_tx_type():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	transaction = _creation(7, type=str(TransactionType.HASH_LOCK.value))

	# Act:
	with pytest.raises(RecoveryStopped, match='transaction identity is inconsistent') as caught:
		proof.apply_page({7: [transaction]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_requires_matching_creation_key():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	transaction = _creation(7)
	transaction['body']['hash'] = 'CD' * 32

	# Act:
	with pytest.raises(RecoveryStopped, match='creation key is inconsistent') as caught:
		proof.apply_page({7: [transaction]}, {7: [_receipt(7)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


@pytest.mark.parametrize('baseline', [(), (BASELINE,)])
def test_reuse_requires_inactive_key(baseline):
	# Arrange:
	proof = HashLockReplayProof({KEY}, baseline, ())

	# Act:
	with pytest.raises(RecoveryStopped, match='proven inactive or absent lock') as caught:
		proof.apply_page({8: [_creation(8)]}, {8: [_receipt(8)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_completion_requires_active_key():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})

	# Act:
	with pytest.raises(RecoveryStopped, match='completion has no proven active creation') as caught:
		proof.apply_page({8: [_completion(8)]}, {8: [_receipt(8, ReceiptType.LOCK_HASH_COMPLETED)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


@pytest.mark.parametrize('receipt_count', [0, 2])
def test_requires_one_creation_receipt(receipt_count):
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})

	# Act:
	with pytest.raises(RecoveryStopped, match='receipt source is missing or ambiguous') as caught:
		proof.apply_page({7: [_creation(7)]}, {7: [_receipt(7)] * receipt_count})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_completion_matches_amount():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (BASELINE,), ())

	# Act:
	with pytest.raises(RecoveryStopped, match='receipt does not match the creation evidence') as caught:
		proof.apply_page({8: [_completion(8)]}, {8: [_receipt(8, ReceiptType.LOCK_HASH_COMPLETED, amount=4321)]})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


def test_proves_receiptless_creation():
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY}, {KEY: 0})
	creation = _creation(7)

	# Act:
	proof.apply_page({7: [creation]}, {}, receiptless_heights={7})

	# Assert:
	assert {(7, KEY, creation['hash'])} == proof.receiptless_creations
	assert {KEY: ((7, BASELINE),)} == proof.lookup_histories()
	assert {BASELINE} == proof.states_at(7)
	assert {KEY} == proof.prunable_at(6, 6)
	assert set() == proof.prunable_at(12, 12)


@pytest.mark.parametrize('has_prior_lifetime,has_receipts,is_alias', [(True, False, False), (False, True, False), (False, False, True)])
def test_receiptless_creation_guards(has_prior_lifetime, has_receipts, is_alias):
	# Arrange:
	baseline = ((*BASELINE[:-1], 'used'),) if has_prior_lifetime else ()
	proof = HashLockReplayProof({KEY}, baseline, {KEY})
	creation = _creation(7, mosaicId='E74B99BA41F4AFEE' if is_alias else NATIVE_MOSAIC_ID)
	# A normalized mosaic child row alone cannot prove a receiptless alias resolution.
	creation['mosaic_rows'][0]['mosaic_id'] = NATIVE_MOSAIC_ID
	receipts = {7: [_receipt(7)]} if has_receipts else {}

	# Act:
	with pytest.raises(RecoveryStopped, match='requires a direct mosaic and a proven absent prior lock') as caught:
		proof.apply_page({7: [creation]}, receipts, receiptless_heights={7})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason


@pytest.mark.parametrize('should_create_first', [False, True])
def test_receiptless_completion_stops(should_create_first):
	# Arrange:
	proof = HashLockReplayProof({KEY}, (), {KEY})
	transactions = {8: [_completion(8)]}
	if should_create_first:
		transactions[7] = [_creation(7)]

	# Act:
	with pytest.raises(RecoveryStopped, match='supports only a single creation per key') as caught:
		proof.apply_page(transactions, {}, receiptless_heights={7} if should_create_first else {8})

	# Assert:
	assert ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING == caught.value.reason
