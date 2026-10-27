from collections import namedtuple

from common.symbol.NativeMosaic import normalize_mosaic_id
from symbolchain.sc import TransactionType

TransactionMosaicRecord = namedtuple(
	'TransactionMosaicRecord',
	['mosaic_id', 'amount', 'role', 'position', 'divisibility', 'alias_names'])
TransactionDetailTransactionRecord = namedtuple(
	'TransactionDetailTransactionRecord',
	['transaction_id', 'hash', 'is_embedded', 'aggregate_hash', 'embedded_index', 'height', 'transaction_type',
		'type_name', 'version', 'signer_public_key', 'signer_address', 'recipient_address', 'target_address',
		'source_address', 'effective_fee', 'timestamp', 'deadline', 'max_fee', 'size', 'signature', 'message_type',
		'message_payload', 'body', 'raw_payload', 'mosaics'])
TransactionDetailRecord = namedtuple(
	'TransactionDetailRecord', ['transaction', 'block', 'children', 'cosignatures', 'hash_lock', 'namespace_names'])
TransactionDetailRelationContext = namedtuple(
	'TransactionDetailRelationContext', ['hash_lock', 'namespace_names', 'sync_state'])
TransactionDetailReadResult = namedtuple(
	'TransactionDetailReadResult', ['record', 'status', 'last_synced_height', 'readable_height'])
TransactionDetailBlockRecord = namedtuple('TransactionDetailBlockRecord', ['height', 'hash', 'timestamp', 'fee_multiplier'])
TransactionHashLockRecord = namedtuple(
	'TransactionHashLockRecord',
	['hash', 'owner_address', 'mosaic_id', 'amount', 'end_height', 'status', 'divisibility', 'alias_names', 'updated_at_height'])


class SymbolDataUnavailable(RuntimeError):
	"""Raised when Symbol block data is not safely readable."""


def _bytes_or_none(value):
	return bytes(value) if value else None


def _is_non_public_state(sync_state):
	return sync_state['status'] == 'repairing' or sync_state['dirty_state_from_height'] is not None


READABLE_BLOCK_STATUSES = frozenset(['healthy', 'repairing'])


def _get_readable_height(sync_state):
	if not sync_state or sync_state.get('status') not in READABLE_BLOCK_STATUSES:
		return None
	last_synced_height = sync_state.get('last_synced_height')
	if not isinstance(last_synced_height, int) or last_synced_height < 1:
		return None
	dirty_state_from_height = sync_state.get('dirty_state_from_height')
	if dirty_state_from_height is not None:
		if not isinstance(dirty_state_from_height, int) or dirty_state_from_height < 1:
			return None
		last_synced_height = min(last_synced_height, dirty_state_from_height - 1)
	return last_synced_height if last_synced_height >= 1 else None


class SymbolTransactionDetailMixin:
	def get_transaction_detail(self, transaction_hash):
		"""Gets one confirmed transaction and snapshot visibility metadata.

		The result status is ``hit``, ``miss`` (clean miss), or ``confirmed_lag``.
		Both watermarks come from the same repeatable-read snapshot as the detail.
	"""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_detail_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: sync state is unreadable')
				candidate = self._fetch_transaction_detail_transaction(cursor, transaction_hash, sync_state, readable_height)
				if isinstance(candidate, TransactionDetailReadResult):
					return candidate
				record = self._assemble_transaction_detail(cursor, candidate, sync_state, readable_height)
				return TransactionDetailReadResult(
					record, 'hit', sync_state['last_synced_height'], readable_height)

	def supplement_transaction_detail(self, transaction_hash, record):
		"""Reads current display relations after a Node-backed detail fetch."""

		if not isinstance(transaction_hash, bytes) or len(transaction_hash) != 32 \
			or record.transaction.hash != transaction_hash:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: Node detail hash mismatch')

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_detail_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: sync state is unreadable')
				self._validate_node_detail_visibility(cursor, record, readable_height, sync_state)
				all_transactions = (record.transaction, *record.children)
				mosaic_ids = tuple(dict.fromkeys(
					mosaic.mosaic_id for transaction in all_transactions for mosaic in transaction.mosaics))
				if record.hash_lock:
					mosaic_ids = tuple(dict.fromkeys((*mosaic_ids, record.hash_lock.mosaic_id)))
					self._assert_current_hash_lock(cursor, record.hash_lock.hash, readable_height)
				namespace_names = self._fetch_transaction_detail_namespace_names(
					cursor, record.transaction, record.children)
				if self.native_mosaic_info is None:
					raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: native mosaic is unavailable')
				needs_current_mosaic_state = any(
					normalize_mosaic_id(mosaic_id) != self.native_mosaic_info.id for mosaic_id in mosaic_ids)
				if _is_non_public_state(sync_state) and (needs_current_mosaic_state or namespace_names or record.hash_lock):
					raise SymbolDataUnavailable(
						'Symbol transaction detail data is unavailable: current metadata is unsafe in dirty or repairing state')
				mosaic_state = {} if _is_non_public_state(sync_state) else self._fetch_transaction_detail_mosaic_state(cursor, mosaic_ids)
				transaction = self._replace_transaction_detail_mosaics(
					record.transaction, {record.transaction.transaction_id: record.transaction.mosaics}, mosaic_state)
				children = tuple(self._replace_transaction_detail_mosaics(
					child, {child.transaction_id: child.mosaics}, mosaic_state) for child in record.children)
				hash_lock = record.hash_lock
				if hash_lock:
					hash_lock = hash_lock._replace(**self._mosaic_state_for_lock(hash_lock, mosaic_state))
				return record._replace(
					transaction=transaction, children=children, hash_lock=hash_lock, namespace_names=namespace_names)

	@staticmethod
	def _validate_node_detail_visibility(cursor, record, readable_height, sync_state):
		parent_hash = record.transaction.hash
		cursor.execute(
			'''SELECT height, is_embedded FROM symbol_transactions WHERE hash = %s''',
			(parent_hash,))
		parent_rows = cursor.fetchall()
		if any(is_embedded for _height, is_embedded in parent_rows):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: hash selected an embedded row')
		rows = list(parent_rows)
		cursor.execute(
			'''SELECT height, is_embedded
			FROM symbol_transactions WHERE aggregate_hash = %s''',
			(parent_hash,))
		rows.extend(cursor.fetchall())
		for height, is_embedded in rows:
			if height > readable_height and _is_non_public_state(sync_state):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: unsafe Node detail relation')

	@staticmethod
	def _fetch_transaction_detail_transaction(cursor, transaction_hash, sync_state, readable_height):
		cursor.execute(
			'''SELECT id, hash, is_embedded, aggregate_hash, embedded_index, height, type, type_name,
				signer_public_key, signer_address, recipient_address, target_address, effective_fee, timestamp,
				deadline, max_fee, size, message_type, message_payload, body, raw_payload
			FROM symbol_transactions WHERE hash = %s''',
			(transaction_hash,))
		transaction_row = cursor.fetchone()
		if not transaction_row:
			if _is_non_public_state(sync_state):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: unsafe miss')
			return TransactionDetailReadResult(None, 'miss', sync_state['last_synced_height'], readable_height)
		if transaction_row[2]:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: hash selected an embedded row')
		if transaction_row[5] > readable_height:
			if _is_non_public_state(sync_state):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: unsafe transaction row')
			return TransactionDetailReadResult(None, 'confirmed_lag', sync_state['last_synced_height'], readable_height)
		transaction = SymbolTransactionDetailMixin._create_transaction_detail_record(transaction_row)
		SymbolTransactionDetailMixin._assert_complete_transaction_detail(transaction)
		return transaction

	def _assemble_transaction_detail(self, cursor, transaction, sync_state, readable_height):
		transaction, block, children, cosignatures, hash_lock = self._fetch_transaction_detail_structure(
			cursor, transaction, sync_state, readable_height)
		namespace_names = self._fetch_transaction_detail_namespace_names(cursor, transaction, children)
		transaction, children, hash_lock = self._fetch_transaction_detail_current_relations(
			cursor, transaction, children, TransactionDetailRelationContext(hash_lock, namespace_names, sync_state))
		return TransactionDetailRecord(transaction, block, children, cosignatures, hash_lock, namespace_names)

	def _fetch_transaction_detail_structure(self, cursor, transaction, sync_state, readable_height):
		cursor.execute(
			'''SELECT height, hash, timestamp, fee_multiplier
			FROM symbol_blocks WHERE height = %s''',
			(transaction.height,))
		block_row = cursor.fetchone()
		if not block_row:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: block is missing')
		block = TransactionDetailBlockRecord(
			height=block_row[0], hash=_bytes_or_none(block_row[1]), timestamp=block_row[2], fee_multiplier=block_row[3])
		children = self._fetch_transaction_detail_children(cursor, transaction.hash, transaction.height)
		addresses = self._fetch_transaction_detail_addresses(cursor, (transaction, *children))
		transaction = self._replace_transaction_detail_addresses(transaction, addresses)
		children = tuple(self._replace_transaction_detail_addresses(child, addresses) for child in children)
		revocations = [item for item in (transaction, *children) if item.transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value]
		if any(item.source_address is None for item in revocations):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: revocation source is missing')
		if transaction.transaction_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
			if not children or [child.embedded_index for child in children] != list(range(len(children))):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: aggregate children are invalid')
			aggregate_types = (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value)
			if any(child.transaction_type in aggregate_types for child in children):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: nested aggregate child')
		else:
			if children:
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: non-aggregate has children')
			children = ()
		cosignatures = self._create_transaction_detail_cosignatures(transaction.body)
		if transaction.transaction_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
			if cosignatures is None:
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: aggregate cosignatures are invalid')
		else:
			cosignatures = ()
		hash_lock = self._fetch_transaction_detail_hash_lock(cursor, transaction, readable_height)
		if transaction.transaction_type == TransactionType.AGGREGATE_BONDED.value and _is_non_public_state(sync_state):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: hash lock is unsafe')
		return transaction, block, tuple(children), cosignatures, hash_lock

	def _fetch_transaction_detail_current_relations(self, cursor, transaction, children, relation_context):
		hash_lock = relation_context.hash_lock
		namespace_names = relation_context.namespace_names
		sync_state = relation_context.sync_state
		all_transactions = (transaction, *children)
		transaction_mosaics = self._fetch_transaction_detail_mosaics(cursor, all_transactions)
		transaction = self._replace_transaction_detail_mosaics(transaction, transaction_mosaics)
		children = tuple(self._replace_transaction_detail_mosaics(child, transaction_mosaics) for child in children)
		mosaic_ids = self._transaction_detail_mosaic_ids(transaction, children, hash_lock)
		if self.native_mosaic_info is None:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: native mosaic is unavailable')
		needs_current_mosaic_state = any(
			normalize_mosaic_id(mosaic_id) != self.native_mosaic_info.id for mosaic_id in mosaic_ids)
		if _is_non_public_state(sync_state) and (needs_current_mosaic_state or namespace_names):
			raise SymbolDataUnavailable(
				'Symbol transaction detail data is unavailable: current metadata is unsafe in dirty or repairing state')
		mosaic_state = {} if _is_non_public_state(sync_state) else self._fetch_transaction_detail_mosaic_state(cursor, mosaic_ids)
		transaction = self._replace_transaction_detail_mosaics(transaction, transaction_mosaics, mosaic_state)
		children = tuple(self._replace_transaction_detail_mosaics(child, transaction_mosaics, mosaic_state) for child in children)
		self._assert_transaction_detail_relations(transaction, children)
		if hash_lock:
			hash_lock = hash_lock._replace(**self._mosaic_state_for_lock(hash_lock, mosaic_state))
		return transaction, tuple(children), hash_lock

	@staticmethod
	def _start_detail_read_transaction(cursor):
		"""Starts the detail-only repeatable-read, read-only boundary."""

		cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
		cursor.execute('SET TRANSACTION READ ONLY')

	@staticmethod
	def _create_transaction_detail_record(row):
		body = row[19] if isinstance(row[19], dict) else None
		raw_payload = row[20] if isinstance(row[20], dict) else None
		raw_transaction = raw_payload.get('transaction') if raw_payload else None
		if not isinstance(raw_transaction, dict):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: rawPayload.transaction is malformed')
		version = raw_transaction.get('version', body.get('version') if body else None)
		signature = raw_transaction.get('signature') if not row[2] else None
		return TransactionDetailTransactionRecord(
			transaction_id=row[0],
			hash=_bytes_or_none(row[1]),
			is_embedded=row[2],
			aggregate_hash=_bytes_or_none(row[3]),
			embedded_index=row[4],
			height=row[5],
			transaction_type=row[6],
			type_name=str(row[7]) if row[7] is not None else None,
			version=version,
			signer_public_key=_bytes_or_none(row[8]),
			signer_address=_bytes_or_none(row[9]),
			recipient_address=_bytes_or_none(row[10]),
			target_address=_bytes_or_none(row[11]),
			source_address=None,
			effective_fee=row[12], timestamp=row[13], deadline=row[14], max_fee=row[15], size=row[16], signature=signature,
			message_type=str(row[17]) if row[17] is not None else None, message_payload=row[18], body=body, raw_payload=raw_payload,
			mosaics=())

	@staticmethod
	def _assert_complete_transaction_detail(transaction):
		required = {
			'height': transaction.height,
			'type': transaction.transaction_type,
			'version': transaction.version,
			'signerPublicKey': transaction.signer_public_key,
			'signerAddress': transaction.signer_address,
			'timestamp': transaction.timestamp,
			'body': transaction.body,
			'rawPayload': transaction.raw_payload
		}
		if not transaction.is_embedded:
			required.update({
				'effectiveFee': transaction.effective_fee,
				'deadline': transaction.deadline,
				'maxFee': transaction.max_fee,
				'size': transaction.size,
				'signature': transaction.signature
			})
		missing = next((field for field, value in required.items() if value is None), None)
		if missing:
			raise SymbolDataUnavailable(f'Symbol transaction detail data is unavailable: missing {missing}')
		required_addresses = {
			TransactionType.TRANSFER.value: ('recipient_address',),
			TransactionType.SECRET_LOCK.value: ('recipient_address',),
			TransactionType.SECRET_PROOF.value: ('recipient_address',),
			TransactionType.ACCOUNT_METADATA.value: ('target_address',),
			TransactionType.MOSAIC_METADATA.value: ('target_address',),
			TransactionType.NAMESPACE_METADATA.value: ('target_address',),
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: ('target_address',)
		}.get(transaction.transaction_type, ())
		if any(getattr(transaction, field) is None for field in required_addresses):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: required address is missing')
		if transaction.message_payload is not None and (
			not isinstance(transaction.message_payload, str) or len(transaction.message_payload) % 2):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: message payload is malformed')
		if transaction.message_payload is not None and any(
			character not in '0123456789abcdefABCDEF' for character in transaction.message_payload):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: message payload is malformed')
		if not isinstance(transaction.version, int) or isinstance(transaction.version, bool):
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: version is malformed')
		if not SymbolTransactionDetailMixin._is_fixed_hex(transaction.signature, 128) and not transaction.is_embedded:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: signature is malformed')

	@staticmethod
	def _is_fixed_hex(value, width):
		return isinstance(value, str) and len(value) == width and all(
			character in '0123456789abcdefABCDEF' for character in value)

	@staticmethod
	def _fetch_transaction_detail_children(cursor, parent_hash, parent_height):
		cursor.execute(
			'''SELECT id, hash, is_embedded, aggregate_hash, embedded_index, height, type, type_name,
				signer_public_key, signer_address, recipient_address, target_address, effective_fee, timestamp,
				deadline, max_fee, size, message_type, message_payload, body, raw_payload
			FROM symbol_transactions
			WHERE aggregate_hash = %s
			ORDER BY embedded_index ASC''',
			(parent_hash,))
		children = tuple(SymbolTransactionDetailMixin._create_transaction_detail_record(row) for row in cursor.fetchall())
		for child in children:
			if not child.is_embedded or child.height != parent_height or child.aggregate_hash != parent_hash:
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: embedded identity is invalid')
			SymbolTransactionDetailMixin._assert_complete_transaction_detail(child)

		return children

	@staticmethod
	def _fetch_transaction_detail_mosaics(cursor, transactions):
		transaction_ids = [transaction.transaction_id for transaction in transactions]

		cursor.execute(
			'''SELECT transaction_id, mosaic_id, amount, role, position
			FROM symbol_transaction_mosaics
			WHERE transaction_id = ANY(%s::bigint[])
			ORDER BY transaction_id, position''',
			(transaction_ids,))
		mosaics_by_transaction = {transaction_id: [] for transaction_id in transaction_ids}
		for transaction_id, mosaic_id, amount, role, position in cursor.fetchall():
			mosaics_by_transaction[transaction_id].append(TransactionMosaicRecord(
				mosaic_id, amount, str(role), position, None, None))
		return mosaics_by_transaction

	@staticmethod
	def _fetch_transaction_detail_addresses(cursor, transactions):
		transaction_ids = [transaction.transaction_id for transaction in transactions]

		cursor.execute(
			'''SELECT transaction_id, address, role
			FROM symbol_transaction_addresses
			WHERE transaction_id = ANY(%s::bigint[])
			AND role = 'sender'::symbol_transaction_address_role''',
			(transaction_ids,))
		addresses = {}
		for transaction_id, address, role in cursor.fetchall():
			if str(role) == 'sender':
				addresses[transaction_id] = _bytes_or_none(address)
		return addresses

	@staticmethod
	def _replace_transaction_detail_addresses(transaction, source_addresses):
		return transaction._replace(source_address=source_addresses.get(transaction.transaction_id))

	@staticmethod
	def _create_transaction_detail_cosignatures(body):
		if not body or not isinstance(body.get('cosignatures'), list):
			return None

		return tuple(body['cosignatures'])

	@staticmethod
	def _fetch_transaction_detail_hash_lock(cursor, transaction, readable_height):
		if transaction.transaction_type != TransactionType.AGGREGATE_BONDED.value:
			return None

		cursor.execute(
			'''SELECT hash, owner_address, mosaic_id, amount, end_height, status, updated_at_height
			FROM symbol_hash_locks WHERE hash = %s''',
			(transaction.hash,))
		row = cursor.fetchone()
		if not row:
			return None

		if row[6] > readable_height:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: hash lock is unsafe')

		return TransactionHashLockRecord(
			_bytes_or_none(row[0]), _bytes_or_none(row[1]), row[2], row[3], row[4], str(row[5]), None, None, row[6])

	@staticmethod
	def _assert_current_hash_lock(cursor, hash_value, readable_height):
		cursor.execute(
			'SELECT updated_at_height FROM symbol_hash_locks WHERE hash = %s',
			(hash_value,))
		row = cursor.fetchone()
		if row and row[0] > readable_height:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: hash lock is unsafe')

	@staticmethod
	def _fetch_transaction_detail_namespace_names(cursor, transaction, children):
		namespace_ids = set()
		for item in (transaction, *children):
			body = item.body or {}
			if item.transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
				continue
			for field in ('namespaceId', 'targetNamespaceId'):
				value = body.get(field)
				if value is not None:
					namespace_ids.add(str(value).upper())
		if not namespace_ids:
			return {}

		cursor.execute(
			'''SELECT namespace_id, full_name FROM symbol_namespaces WHERE namespace_id = ANY(%s::varchar[])''',
			(list(namespace_ids),))
		result = {str(namespace_id).upper(): None for namespace_id in namespace_ids}
		result.update({str(namespace_id).upper(): full_name for namespace_id, full_name in cursor.fetchall()})
		return result

	@staticmethod
	def _transaction_detail_mosaic_ids(transaction, children, hash_lock):
		ids = []
		for item in (transaction, *children):
			ids.extend(mosaic.mosaic_id for mosaic in item.mosaics)
		if hash_lock:
			ids.append(hash_lock.mosaic_id)
		return tuple(dict.fromkeys(ids))

	@staticmethod
	def _fetch_transaction_detail_mosaic_state(cursor, mosaic_ids):
		if not mosaic_ids:
			return {}

		cursor.execute(
			'''SELECT mosaic_id, divisibility, alias_names
			FROM symbol_mosaics WHERE mosaic_id = ANY(%s::varchar[])''',
			(list(mosaic_ids),))
		return {mosaic_id: (divisibility, alias_names) for mosaic_id, divisibility, alias_names in cursor.fetchall()}

	@staticmethod
	def _replace_transaction_detail_mosaics(transaction, mosaics_by_transaction, mosaic_state=None):
		mosaic_state = mosaic_state or {}
		mosaics = tuple(
			mosaic._replace(
				divisibility=mosaic_state.get(mosaic.mosaic_id, (None, None))[0],
				alias_names=mosaic_state.get(mosaic.mosaic_id, (None, None))[1])
			for mosaic in mosaics_by_transaction.get(transaction.transaction_id, transaction.mosaics))
		return transaction._replace(mosaics=mosaics)

	@staticmethod
	def _assert_transaction_detail_relations(transaction, children):
		"""Rejects confirmed rows that lack relation records required by their type."""

		required_roles = {
			TransactionType.HASH_LOCK.value: 'hash_lock',
			TransactionType.MOSAIC_DEFINITION.value: 'definition',
			TransactionType.SECRET_LOCK.value: 'secret_lock',
			TransactionType.MOSAIC_METADATA.value: 'metadata_target',
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: 'definition',
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: 'restriction',
			TransactionType.MOSAIC_SUPPLY_REVOCATION.value: 'revocation'
		}
		for item in (transaction, *children):
			required_role = required_roles.get(item.transaction_type)
			if required_role and not any(mosaic.role == required_role for mosaic in item.mosaics):
				raise SymbolDataUnavailable(
					f'Symbol transaction detail data is unavailable: missing {required_role} mosaic relation')
			if item.transaction_type == TransactionType.MOSAIC_GLOBAL_RESTRICTION.value \
				and not any(mosaic.role == 'restriction' for mosaic in item.mosaics):
				raise SymbolDataUnavailable(
					'Symbol transaction detail data is unavailable: missing restriction mosaic relation')

	@staticmethod
	def _mosaic_state_for_lock(hash_lock, mosaic_state):
		divisibility, alias_names = mosaic_state.get(hash_lock.mosaic_id, (None, None))
		return {'divisibility': divisibility, 'alias_names': alias_names}
