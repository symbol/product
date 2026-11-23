"""Derivation of affected Symbol Hash Lock state at each canonical replay height."""

from collections import Counter, defaultdict, namedtuple

from common.symbol.ReceiptTypes import RECEIPT_TYPE_LABELS
from symbolchain.sc import ReceiptType, TransactionType

from puller.facade.ForkReconciliation import RecoveryStopped
from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason
from puller.model.symbol.format import hash_bytes_from_hex, is_exact_integer, is_hex_text
from puller.model.symbol.Lock import create_hash_lock_key
from puller.model.symbol.Resolution import is_alias_mosaic_id
from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS

HASH_LOCK = TransactionType.HASH_LOCK.value
AGGREGATE_BONDED = TransactionType.AGGREGATE_BONDED.value
CREATED = RECEIPT_TYPE_LABELS[ReceiptType.LOCK_HASH_CREATED.value]
COMPLETED = RECEIPT_TYPE_LABELS[ReceiptType.LOCK_HASH_COMPLETED.value]
MAX_UINT64 = (1 << 64) - 1
LockState = namedtuple('LockState', 'key owner mosaic_id amount end_height status')


def _stop(message):
	raise RecoveryStopped(ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, message)


def _key_from_transaction(transaction_row):
	item = transaction_row['raw_payload']
	if HASH_LOCK == transaction_row['type']:
		return create_hash_lock_key(hash_bytes_from_hex(item['transaction'], 'hash', 'Symbol Hash Lock creation'))

	return create_hash_lock_key(hash_bytes_from_hex(item['meta'], 'hash', 'Symbol Aggregate Bonded completion'))


def _is_resolved_mosaic_id(mosaic_id):
	return isinstance(mosaic_id, str) and len(mosaic_id) == 16 and is_hex_text(mosaic_id) and not is_alias_mosaic_id(mosaic_id)


def _creation_state(height, key, transaction):
	body = transaction['body']
	raw = transaction['raw_payload']['transaction']
	duration = raw.get('duration')
	if isinstance(duration, str) and duration.isascii() and duration.isdecimal() and len(duration) <= 20:
		duration = int(duration)

	if not is_exact_integer(duration) or not 0 < duration <= MAX_UINT64 - height or raw.get('duration') != body.get('duration'):
		_stop('Canonical Symbol Hash Lock duration cannot be proven')

	mosaics = transaction['mosaic_rows']
	if len(mosaics) != 1:
		_stop('Canonical Symbol Hash Lock mosaic cannot be proven')

	mosaic = mosaics[0]
	mosaic_id, amount = mosaic['mosaic_id'], mosaic['amount']
	has_mosaic_position = ('hash_lock', 0) == (mosaic['role'], mosaic['position'])
	has_valid_amount = is_exact_integer(amount) and 0 < amount <= MAX_UINT64
	if not has_mosaic_position or not has_valid_amount or not _is_resolved_mosaic_id(mosaic_id):
		_stop('Canonical Symbol Hash Lock mosaic cannot be proven')

	return LockState(key, transaction['signer_address'], mosaic_id.upper(), amount, height + duration, 'unused')


def _check_receipt(receipts, index, expected_type, state):
	at_source = [
		row for row in receipts
		if (row['source_primary_id'], row['source_secondary_id']) == (index + 1, 0) and row['receipt_type'] in (CREATED, COMPLETED)
	]
	if len(at_source) != 1 or at_source[0]['receipt_type'] != expected_type:
		_stop('Canonical Symbol Hash Lock receipt source is missing or ambiguous')

	receipt = at_source[0]
	mosaic_id = receipt['mosaic_id']
	if (receipt['target_address'], mosaic_id.upper() if isinstance(mosaic_id, str) else None, receipt['amount']) != state[1:4]:
		_stop('Canonical Symbol Hash Lock receipt does not match the creation evidence')


class HashLockReplayProof:
	"""Applies validated canonical events to lock state at the verified repair cut."""

	def __init__(self, keys, baseline_states, prunable_keys, pruning_heights=()):
		self.keys = frozenset(keys)
		self._baseline_states = {state[0]: LockState(*state) for state in baseline_states}
		self._initially_prunable_keys = frozenset(prunable_keys)
		self._pruning_heights = dict(pruning_heights)
		self._current_states = self._baseline_states.copy()
		self._transitions = []
		self._receiptless_creations = {}

	@property
	def receiptless_creations(self):
		"""Identifies the canonical creation transactions proven without statements."""

		return frozenset(self._receiptless_creations.values())

	def lookup_histories(self):
		"""Returns the ordered canonical state transitions per lock key."""

		histories = defaultdict(list)
		for height, state in self._transitions:
			histories[state.key].append((height, state))

		return {key: tuple(transitions) for key, transitions in histories.items()}

	def states_at(self, height):
		"""Returns the latest proven state per key through the specified block."""

		states = self._baseline_states.copy()
		for event_height, state in self._transitions:
			if event_height > height:
				break

			states[state.key] = state

		return set(states.values())

	def prunable_at(self, height, finalized_height=None):
		"""Returns keys whose complete history can be pruned through the proven finality."""

		if finalized_height is None:
			return self._initially_prunable_keys.difference(
				state.key for event_height, state in self._transitions if event_height <= height)

		# Core prunes from the oldest entry. A used entry needs no expiry receipt,
		# but its end height still constrains removal of subsequent lifetimes.
		bounds = self._pruning_heights.copy()
		for event_height, state in self._transitions:
			if event_height > height:
				break

			if state.key in self._receiptless_creations:
				bounds.pop(state.key, None)
			elif state.key in bounds:
				bounds[state.key] = max(bounds[state.key], state.end_height)

		return {key for key, end_height in bounds.items() if end_height <= finalized_height}

	def apply_page(self, transactions_by_height, receipts_by_height, *, receiptless_heights=()):
		"""Applies one completely fetched transaction page range and its statements."""

		for height, transactions in sorted(transactions_by_height.items()):
			self._apply_block(height, transactions, receipts_by_height.get(height, ()), height in receiptless_heights)

	def _apply_block(self, height, transactions, receipts, is_receiptless):
		source_counts = Counter(row['block_index'] for row in transactions if not row['is_embedded'])
		events = []
		for transaction in transactions:
			if transaction['type'] not in (HASH_LOCK, AGGREGATE_BONDED):
				continue

			key = _key_from_transaction(transaction)
			if key not in self.keys:
				continue

			index = transaction['block_index']
			raw_index = transaction['raw_payload']['meta'].get('index')
			if not is_exact_integer(raw_index) or not 0 <= raw_index < 2**31 - 1 or index != raw_index or source_counts[index] != 1:
				_stop('Canonical Symbol Hash Lock transaction source is missing or ambiguous')

			events.append((index, key, transaction))

		for event in sorted(events):
			self._apply_event(height, event, receipts, is_receiptless)

	def _apply_event(self, height, event, receipts, is_receiptless):
		index, key, transaction = event
		raw = transaction['raw_payload']['transaction']
		transaction_type = transaction['type']
		has_matching_type = raw.get('type') == transaction_type and transaction['type_name'] == TRANSACTION_TYPE_LABELS[transaction_type]
		if transaction['is_embedded'] or not has_matching_type:
			_stop('Canonical Symbol Hash Lock transaction identity is inconsistent')

		if key in self._receiptless_creations or is_receiptless and HASH_LOCK != transaction_type:
			_stop('Canonical receiptless Symbol Hash Lock replay supports only a single creation per key')

		previous = self._current_states.get(key)
		if HASH_LOCK == transaction_type:
			if key != create_hash_lock_key(transaction['body']['hash']):
				_stop('Canonical Symbol Hash Lock creation key is inconsistent')

			# Catapult HashLockCacheUniqueValidator permits reuse only when the previous lock is inactive.
			# See _symbol/client/catapult/plugins/txes/lock_hash/src/validators at b3222548d6c8.
			was_absent = previous is None and key in self._initially_prunable_keys
			was_inactive = previous and (previous.status == 'used' or previous.end_height <= height)
			if not was_absent and not was_inactive:
				_stop('Canonical Symbol Hash Lock creation cannot be related to a proven inactive or absent lock')

			state = _creation_state(height, key, transaction)
			if is_receiptless:
				self._record_receiptless_creation(height, transaction, state, was_absent, receipts)
			else:
				_check_receipt(receipts, index, CREATED, state)
		else:
			if key.hash != transaction['hash'] or previous is None or previous.status != 'unused' or previous.end_height <= height:
				_stop('Canonical Symbol Hash Lock completion has no proven active creation')

			_check_receipt(receipts, index, COMPLETED, previous)
			state = LockState(previous.key, previous.owner, previous.mosaic_id, previous.amount, previous.end_height, 'used')

		self._current_states[key] = state
		self._transitions.append((height, state))

	def _record_receiptless_creation(self, height, transaction, state, was_absent, receipts):
		raw_mosaic_id = transaction['raw_payload']['transaction'].get('mosaicId')
		if receipts or not was_absent or not _is_resolved_mosaic_id(raw_mosaic_id) or raw_mosaic_id.upper() != state.mosaic_id:
			_stop('Canonical receiptless Symbol Hash Lock requires a direct mosaic and a proven absent prior lock')

		self._receiptless_creations[state.key] = (height, state.key, transaction['hash'])
