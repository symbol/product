import asyncio
import copy
import threading
import time
from collections import OrderedDict, namedtuple

import aiohttp
from common.symbol.NativeMosaic import NativeMosaicInfo, normalize_mosaic_id
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabaseCommon import TransactionMosaicRecord
from rest.db.SymbolTransactionDetail import TransactionDetailRecord, TransactionDetailTransactionRecord, TransactionHashLockRecord
from rest.model.symbol.Transaction import (
	AGGREGATE_TRANSACTION_TYPES,
	MOSAIC_DEFINITION_FLAGS,
	SYMBOL_TRANSACTION_DETAIL_REQUIRED_BODY_FIELDS,
	SymbolTransactionDetailView
)
from rest.model.symbol.validation import SymbolDataInvalid

NodeTransactionContext = namedtuple(
	'NodeTransactionContext', ['transaction', 'meta', 'transaction_type', 'version', 'parent_hash', 'parent', 'index'])
NodeTransactionIdentity = namedtuple(
	'NodeTransactionIdentity', ['signer_public_key', 'signer_address', 'addresses', 'body', 'message_type', 'message_payload', 'mosaics'])


class SymbolNodeNotFound(RuntimeError):
	"""Raised when the requested Node resource does not exist."""


class SymbolNodeUnavailable(RuntimeError):
	"""Raised when the Node response cannot satisfy the detail contract."""


class AsyncLruCache:
	def __init__(self, ttl_seconds, max_entries, clock):
		self.ttl_seconds = ttl_seconds
		self.max_entries = max_entries
		self.clock = clock
		self.entries = OrderedDict()
		self.lock = threading.Lock()

	async def get_or_load(self, key, loader):
		"""Returns a cached copy or loads, stores, and returns a new value."""
		with self.lock:
			entry = self.entries.get(key)
			if entry and self.clock() - entry[0] < self.ttl_seconds:
				self.entries.move_to_end(key)
				return copy.deepcopy(entry[1])

		value = await loader()
		with self.lock:
			self.entries[key] = (self.clock(), copy.deepcopy(value))
			self.entries.move_to_end(key)
			if len(self.entries) > self.max_entries:
				self.entries.popitem(last=False)

		return copy.deepcopy(value)


class AiohttpTransport:
	def __init__(self, node_config, session_factory=None):
		self.node_config = node_config
		self.session_factory = session_factory if session_factory is not None else aiohttp.ClientSession

	async def get_json(self, path):
		"""Fetches Node JSON; 404 raises ``SymbolNodeNotFound`` and other failures raise ``SymbolNodeUnavailable``."""
		try:
			timeout = aiohttp.ClientTimeout(total=self.node_config.timeout_seconds)
			async with self.session_factory(timeout=timeout) as session:
				async with session.get(f'{self.node_config.base_url}/{path}', allow_redirects=False) as response:
					if response.status == 404:
						raise SymbolNodeNotFound

					if response.status < 200 or response.status >= 300:
						raise SymbolNodeUnavailable

					try:
						return await response.json(content_type=None)
					except (aiohttp.ContentTypeError, ValueError) as error:
						raise SymbolNodeUnavailable from error
		except (aiohttp.ClientError, asyncio.TimeoutError, SymbolNodeConfigurationError, OSError) as error:
			raise SymbolNodeUnavailable from error


class SymbolTransactionNodeBacking:
	"""Loads and validates the limited Symbol Node resources used by detail."""

	CACHE_TTL_SECONDS = 5
	CACHE_MAX_ENTRIES = 1024
	VALID_GROUPS = frozenset(('confirmed', 'unconfirmed', 'partial'))

	# Native mosaic info is required alongside Node transport dependencies.
	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self, node_config, network, native_mosaic_info, transport, clock=None):
		if not isinstance(native_mosaic_info, NativeMosaicInfo):
			raise ValueError('Native mosaic information is required')

		self.node_config = node_config
		self.network = network
		self.native_mosaic_info = native_mosaic_info
		self.transport = transport
		self.clock = clock or time.monotonic
		self.caches = {
			'status': AsyncLruCache(self.CACHE_TTL_SECONDS, self.CACHE_MAX_ENTRIES, self.clock),
			'unconfirmed': AsyncLruCache(self.CACHE_TTL_SECONDS, self.CACHE_MAX_ENTRIES, self.clock),
			'partial': AsyncLruCache(self.CACHE_TTL_SECONDS, self.CACHE_MAX_ENTRIES, self.clock),
			'lock': AsyncLruCache(self.CACHE_TTL_SECONDS, self.CACHE_MAX_ENTRIES, self.clock)
		}

	async def get_status(self, transaction_hash):
		"""Returns validated status JSON; unavailable or failed status is raised."""
		key = ('transactionStatus', transaction_hash.upper())
		return await self._get_cached(
			'status', key, f'transactionStatus/{transaction_hash.upper()}',
			lambda payload: self._validate_status(payload, transaction_hash))

	async def get_transaction(self, group, transaction_hash):
		"""Returns validated pending transaction JSON for an allowed group."""
		if group not in ('unconfirmed', 'partial'):
			raise SymbolNodeUnavailable

		path = f'transactions/{group}/{transaction_hash.upper()}'
		key = (group, transaction_hash.upper())
		return await self._get_cached(
			group, key, path, lambda payload: self._validate_transaction(payload, group, transaction_hash))

	async def try_get_hash_lock(self, transaction_hash):
		"""Returns validated Node hash-lock JSON, or ``None`` when Node returns 404."""
		key = ('lock', transaction_hash.upper())
		try:
			return await self._get_cached(
				'lock', key, f'lock/hash/{transaction_hash.upper()}',
				lambda payload: self._validate_hash_lock(payload, transaction_hash))
		except SymbolNodeNotFound:
			return None

	async def _get_cached(self, cache_kind, key, path, validator):
		async def load():
			payload = await self._dispatch(path)
			return validator(payload)

		return await self.caches[cache_kind].get_or_load(key, load)

	async def _dispatch(self, path):
		try:
			await asyncio.to_thread(self.node_config.assert_request_allowed, self.node_config.base_url)
			return await self.transport.get_json(path)
		except (SymbolNodeConfigurationError, OSError, asyncio.TimeoutError, aiohttp.ClientError) as error:
			raise SymbolNodeUnavailable from error

	@classmethod
	def _validate_status(cls, payload, transaction_hash):
		if not isinstance(payload, dict):
			raise SymbolNodeUnavailable

		group = payload.get('group')
		if not isinstance(group, str):
			raise SymbolNodeUnavailable

		if not cls._same_hash(payload.get('hash'), transaction_hash):
			raise SymbolNodeUnavailable

		if group == 'failed':
			raise SymbolNodeNotFound

		if group not in cls.VALID_GROUPS:
			raise SymbolNodeUnavailable

		if group == 'confirmed':
			height = payload.get('height')
			try:
				height = cls._uint(height)
			except SymbolNodeUnavailable as error:
				raise SymbolNodeUnavailable from error

			if height < 1:
				raise SymbolNodeUnavailable

			payload = dict(payload)
			payload['height'] = height

		return payload

	@staticmethod
	def _same_hash(value, expected):
		return isinstance(value, str) and isinstance(expected, str) and value.upper() == expected.upper()

	def _validate_transaction(self, payload, group, transaction_hash):
		if not isinstance(payload, dict):
			raise SymbolNodeUnavailable

		meta = payload.get('meta') if isinstance(payload.get('meta'), dict) else {}
		transaction = payload.get('transaction')
		if not isinstance(transaction, dict):
			raise SymbolNodeUnavailable

		response_hash = meta.get('hash') or meta.get('transactionHash') or transaction.get('hash')
		if not self._same_hash(response_hash, transaction_hash):
			raise SymbolNodeUnavailable

		record = self.to_detail_record(payload, group, transaction_hash)
		try:
			SymbolTransactionDetailView(record, group).to_dict(self.native_mosaic_info, self.network)
		except (KeyError, TypeError, ValueError, SymbolDataInvalid) as error:
			raise SymbolNodeUnavailable from error

		return copy.deepcopy(payload)

	def _validate_hash_lock(self, payload, transaction_hash):
		if not isinstance(payload, dict):
			raise SymbolNodeUnavailable

		lock = payload.get('lock', payload)
		if not isinstance(lock, dict):
			raise SymbolNodeUnavailable

		response_hash = lock.get('hash') or lock.get('transactionHash') or payload.get('hash')
		if not self._same_hash(response_hash, transaction_hash):
			raise SymbolNodeUnavailable

		status = lock.get('status')
		if isinstance(status, int) and not isinstance(status, bool):
			status = {0: 'unused', 1: 'used'}.get(status)

		if status not in ('unused', 'used'):
			raise SymbolNodeUnavailable

		owner = lock.get('ownerAddress')
		mosaic_id = lock.get('mosaicId')
		amount = lock.get('amount')
		end_height = lock.get('endHeight')
		if not isinstance(owner, str) or mosaic_id is None or amount is None or end_height is None:
			raise SymbolNodeUnavailable

		validated = {
			'hash': transaction_hash.upper(),
			'ownerAddress': owner,
			'mosaicId': mosaic_id,
			'amount': amount,
			'endHeight': end_height,
			'status': status
		}
		self.to_hash_lock_record(validated)
		return validated

	def to_detail_record(self, payload, group, transaction_hash):
		"""Converts validated pending Node JSON to the detail record representation."""
		if group not in ('unconfirmed', 'partial'):
			raise SymbolNodeUnavailable

		transaction = self._create_transaction(payload, transaction_hash, None, None)
		children = tuple(
			self._create_transaction(child, transaction_hash, transaction, index)
			for child, index in self._children(payload, transaction_hash))
		if any(child.transaction_type in AGGREGATE_TRANSACTION_TYPES for child in children):
			raise SymbolNodeUnavailable

		if transaction.transaction_type not in AGGREGATE_TRANSACTION_TYPES and children:
			raise SymbolNodeUnavailable

		if transaction.transaction_type in AGGREGATE_TRANSACTION_TYPES and not children:
			raise SymbolNodeUnavailable

		return TransactionDetailRecord(transaction, None, children, self._cosignatures(transaction), None, {})

	def to_hash_lock_record(self, payload):
		"""Converts validated Node lock JSON to a record; ``None`` means no lock."""
		if payload is None:
			return None

		try:
			hash_value = self._fixed_hex(payload['hash'], 64)
			owner = self._address_bytes(payload['ownerAddress'])
			mosaic_id = self._mosaic_id(payload['mosaicId'])
			amount = self._uint(payload['amount'])
			end_height = self._uint(payload['endHeight'])
		except (KeyError, TypeError, ValueError, SymbolNodeUnavailable) as error:
			raise SymbolNodeUnavailable from error

		return TransactionHashLockRecord(
			bytes.fromhex(hash_value), owner, mosaic_id, amount, end_height, payload['status'], None, None, None)

	def _create_transaction(self, payload, parent_hash, parent, index):
		if not isinstance(payload, dict):
			raise SymbolNodeUnavailable

		meta = payload.get('meta') if isinstance(payload.get('meta'), dict) else {}
		transaction = payload.get('transaction', payload)
		if not isinstance(transaction, dict):
			raise SymbolNodeUnavailable

		transaction_type = self._uint(transaction.get('type'))
		if transaction_type not in {transaction.value for transaction in TransactionType}:
			raise SymbolNodeUnavailable

		version = self._uint(transaction.get('version'))
		self._validate_network(transaction)
		self._validate_type_body(transaction, transaction_type)
		return self._create_transaction_record(
			NodeTransactionContext(transaction, meta, transaction_type, version, parent_hash, parent, index))

	def _create_transaction_record(self, context):
		is_embedded = context.parent is not None
		identity = self._create_transaction_identity(context.transaction, context.transaction_type)
		response_hash = context.meta.get('hash') or context.meta.get('transactionHash') or (context.parent_hash if not is_embedded else None)
		hash_value = None if is_embedded else self._fixed_hex(response_hash, 64)
		aggregate_hash = self._fixed_hex(context.meta.get('aggregateHash') or context.parent_hash, 64) if is_embedded else None
		embedded_index = context.index if is_embedded else None
		signature = None if is_embedded else self._fixed_hex(context.transaction.get('signature'), 128)
		return TransactionDetailTransactionRecord(
			0, bytes.fromhex(hash_value) if hash_value else None, is_embedded, bytes.fromhex(aggregate_hash) if aggregate_hash else None,
			embedded_index, None, context.transaction_type, str(context.transaction_type), context.version,
			bytes.fromhex(identity.signer_public_key), identity.signer_address, *identity.addresses,
			None, None, None if is_embedded else self._deadline(context.transaction.get('deadline')),
			None if is_embedded else self._required_uint(context.transaction.get('maxFee')),
			None if is_embedded else self._required_uint(context.transaction.get('size')), signature, identity.message_type,
			identity.message_payload,
			identity.body, {'transaction': context.transaction}, identity.mosaics)

	def _create_transaction_identity(self, transaction, transaction_type):
		signer_public_key = self._fixed_hex(transaction.get('signerPublicKey'), 64)
		signer_address = self.network.public_key_to_address(PublicKey(bytes.fromhex(signer_public_key))).bytes
		addresses = tuple(self._optional_address(transaction.get(field)) for field in ('recipientAddress', 'targetAddress', 'sourceAddress'))
		required_addresses = {
			TransactionType.TRANSFER.value: (0,),
			TransactionType.SECRET_LOCK.value: (0,),
			TransactionType.SECRET_PROOF.value: (0,),
			TransactionType.ACCOUNT_METADATA.value: (1,),
			TransactionType.MOSAIC_METADATA.value: (1,),
			TransactionType.NAMESPACE_METADATA.value: (1,),
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: (1,),
			TransactionType.MOSAIC_SUPPLY_REVOCATION.value: (2,)
		}.get(transaction_type, ())
		if any(addresses[index] is None for index in required_addresses):
			raise SymbolNodeUnavailable

		if transaction_type == TransactionType.ADDRESS_ALIAS.value:
			self._address_bytes(transaction.get('address'))

		return NodeTransactionIdentity(
			signer_public_key, signer_address, addresses, copy.deepcopy(transaction),
			*self._message(transaction.get('message')), self._mosaics(transaction, transaction_type))

	def _children(self, payload, parent_hash):
		transaction = payload.get('transaction', payload)
		children = transaction.get('transactions', [])
		if not isinstance(children, list):
			raise SymbolNodeUnavailable

		indexed = []
		for child in children:
			meta = child.get('meta') if isinstance(child, dict) else None
			index = meta.get('index') if isinstance(meta, dict) else None
			aggregate_hash = meta.get('aggregateHash') if isinstance(meta, dict) else None
			if not isinstance(index, int) or isinstance(index, bool) or index < 0 or not self._same_hash(aggregate_hash, parent_hash):
				raise SymbolNodeUnavailable

			indexed.append((child, index))

		sorted_indexes = [index for _child, index in sorted(indexed, key=lambda item: item[1])]
		if len(set(sorted_indexes)) != len(sorted_indexes) or sorted_indexes != list(range(len(sorted_indexes))):
			raise SymbolNodeUnavailable

		return sorted(indexed, key=lambda item: item[1])

	@staticmethod
	def _cosignatures(transaction):
		body = transaction.body
		cosignatures = body.get('cosignatures')
		return tuple(cosignatures) if isinstance(cosignatures, list) else ()

	def _mosaics(self, transaction, transaction_type):  # pylint: disable=too-many-branches
		values = transaction.get('mosaics', [])
		if not isinstance(values, list):
			raise SymbolNodeUnavailable

		role = 'transfer'
		amount_field = None
		if transaction_type in (TransactionType.HASH_LOCK.value, TransactionType.SECRET_LOCK.value):
			role = 'hash_lock' if transaction_type == TransactionType.HASH_LOCK.value else 'secret_lock'
			amount_field = 'amount'
		elif transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			amount_field = 'delta'
		elif transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value:
			amount_field = 'amount'

		if transaction_type in (TransactionType.MOSAIC_DEFINITION.value, TransactionType.MOSAIC_SUPPLY_CHANGE.value):
			role = 'definition'
		elif transaction_type in (TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, TransactionType.MOSAIC_GLOBAL_RESTRICTION.value):
			role = 'restriction'
		elif transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value:
			role = 'revocation'
		elif transaction_type == TransactionType.MOSAIC_METADATA.value:
			role = 'metadata_target'

		if transaction_type in (TransactionType.HASH_LOCK.value, TransactionType.SECRET_LOCK.value):
			if transaction.get('mosaicId') is None or transaction.get('amount') is None:
				raise SymbolNodeUnavailable

			values = [{'id': transaction['mosaicId'], 'amount': transaction['amount']}]
		elif transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value and transaction.get('amount') is None:
			raise SymbolNodeUnavailable
		elif not values:
			mosaic_id = {
				TransactionType.MOSAIC_DEFINITION.value: transaction.get('id'),
				TransactionType.MOSAIC_SUPPLY_CHANGE.value: transaction.get('mosaicId'),
				TransactionType.MOSAIC_SUPPLY_REVOCATION.value: transaction.get('mosaicId'),
				TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: transaction.get('mosaicId'),
				TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: transaction.get('mosaicId'),
				TransactionType.MOSAIC_METADATA.value: transaction.get('targetMosaicId')
			}.get(transaction_type)
			if mosaic_id is not None:
				values = [{'id': mosaic_id, 'amount': transaction.get(amount_field, 0)}]

		if transaction_type in (
			TransactionType.TRANSFER.value,
			TransactionType.MOSAIC_SUPPLY_REVOCATION.value):
			if any(not isinstance(item, dict) or 'amount' not in item for item in values):
				raise SymbolNodeUnavailable

		result = [
			TransactionMosaicRecord(
				self._mosaic_id(item.get('id')),
				self._uint(item['amount']) if 'amount' in item else self._uint(transaction.get(amount_field, 0)),
				role, position, None, None)
			for position, item in enumerate(values) if isinstance(item, dict)]
		if len(result) != len(values):
			raise SymbolNodeUnavailable

		return tuple(result)

	@staticmethod
	def _message(message):
		if message is None:
			return None, None

		if isinstance(message, dict):
			message_type = message.get('type')
			if message_type not in ('plain', 'encrypted', 'persistentDelegationHarvesting'):
				raise SymbolNodeUnavailable

			payload = message.get('payload')
			SymbolTransactionNodeBacking._validate_message_payload(payload)
			return message_type, payload

		if not isinstance(message, str):
			raise SymbolNodeUnavailable

		if message.startswith('FE2A8061577301E2'):
			payload = message[16:]
			SymbolTransactionNodeBacking._validate_message_payload(payload)
			return 'persistentDelegationHarvesting', payload

		if len(message) >= 2 and message[:2] in ('00', '01'):
			payload = message[2:]
			SymbolTransactionNodeBacking._validate_message_payload(payload)
			return ('plain' if message[:2] == '00' else 'encrypted'), payload

		SymbolTransactionNodeBacking._validate_message_payload(message)
		return None, message

	@staticmethod
	def _validate_message_payload(payload):
		if not isinstance(payload, str) or len(payload) % 2 or any(
			character not in '0123456789abcdefABCDEF' for character in payload):
			raise SymbolNodeUnavailable

	def _validate_network(self, transaction):
		network = transaction.get('network')
		if network is None or self._uint(network) != self.network.identifier:
			raise SymbolNodeUnavailable

	@staticmethod
	def _validate_type_body(transaction, transaction_type):  # pylint: disable=too-many-branches
		required_fields = SYMBOL_TRANSACTION_DETAIL_REQUIRED_BODY_FIELDS.get(transaction_type, ())
		if transaction_type in AGGREGATE_TRANSACTION_TYPES:
			required_fields = (*required_fields, 'cosignatures')

		if any(field not in transaction or transaction[field] is None for field in required_fields):
			raise SymbolNodeUnavailable

		if transaction_type == TransactionType.ADDRESS_ALIAS.value:
			SymbolTransactionNodeBacking._address_bytes(transaction['address'])

		if transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			registration_type = transaction.get('registrationType')
			if registration_type in (0, '0', 'root'):
				if transaction.get('duration') is None or transaction.get('parentId') not in (None, ''):
					raise SymbolNodeUnavailable
			elif registration_type in (1, '1', 'child', 'sub'):
				if transaction.get('parentId') is None or transaction.get('duration') not in (None, ''):
					raise SymbolNodeUnavailable
			else:
				raise SymbolNodeUnavailable

		for field in ('cosignatures', 'addressAdditions', 'addressDeletions', 'restrictionAdditions', 'restrictionDeletions'):
			if field in transaction and not isinstance(transaction[field], list):
				raise SymbolNodeUnavailable

		string_fields = ('linkAction', 'aliasAction', 'registrationType', 'action', 'hashAlgorithm', 'restrictionFlags')
		string_fields += ('previousRestrictionType', 'newRestrictionType')
		for field in string_fields:
			if field in transaction and (isinstance(transaction[field], bool) or not isinstance(transaction[field], (int, str))):
				raise SymbolNodeUnavailable

		for field, minimum, maximum in (
			('startEpoch', 0, 0xFFFFFFFF), ('endEpoch', 0, 0xFFFFFFFF),
			('minApprovalDelta', -128, 127), ('minRemovalDelta', -128, 127),
			('valueSizeDelta', -32768, 32767), ('nonce', 0, 0xFFFFFFFF), ('divisibility', 0, 255)):
			if field not in transaction:
				continue

			value = transaction[field]
			if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
				raise SymbolNodeUnavailable

		for field in ('addressAdditions', 'addressDeletions', 'restrictionAdditions', 'restrictionDeletions'):
			if transaction_type == TransactionType.ACCOUNT_OPERATION_RESTRICTION.value and field in (
				'restrictionAdditions', 'restrictionDeletions'):
				values = transaction.get(field, ())
				if any(isinstance(value, bool) or not isinstance(value, int) for value in values):
					raise SymbolNodeUnavailable

				if any(value < 0 or value > 0xFFFF for value in values):
					raise SymbolNodeUnavailable
			elif any(not isinstance(value, str) for value in transaction.get(field, ())):
				raise SymbolNodeUnavailable
			elif field in ('addressAdditions', 'addressDeletions'):
				for value in transaction.get(field, ()):
					SymbolTransactionNodeBacking._address_bytes(value)

		if transaction_type == TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value:
			for field in ('restrictionAdditions', 'restrictionDeletions'):
				for value in transaction.get(field, ()):
					SymbolTransactionNodeBacking._address_bytes(value)

		if transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			flags = transaction['flags']
			if isinstance(flags, bool) or not isinstance(flags, int) or flags < 0 \
				or flags & ~MOSAIC_DEFINITION_FLAGS:
				raise SymbolNodeUnavailable

		for cosignature in transaction.get('cosignatures', ()):
			if not isinstance(cosignature, dict) or not SymbolTransactionNodeBacking._fixed_hex(
				cosignature.get('signerPublicKey'), 64) or not SymbolTransactionNodeBacking._fixed_hex(
				cosignature.get('signature'), 128):
				raise SymbolNodeUnavailable

	@staticmethod
	def _fixed_hex(value, width):
		if not isinstance(value, str) or len(value) != width or any(character not in '0123456789abcdefABCDEF' for character in value):
			raise SymbolNodeUnavailable

		return value.upper()

	@staticmethod
	def _uint(value):
		if isinstance(value, bool) or not isinstance(value, (int, str)):
			raise SymbolNodeUnavailable

		if isinstance(value, str) and (not value or not value.isdecimal()):
			raise SymbolNodeUnavailable

		try:
			parsed = int(value)
		except (TypeError, ValueError) as error:
			raise SymbolNodeUnavailable from error

		if parsed < 0 or parsed > 0xFFFFFFFFFFFFFFFF:
			raise SymbolNodeUnavailable

		return parsed

	@classmethod
	def _required_uint(cls, value):
		if value is None:
			raise SymbolNodeUnavailable

		return cls._uint(value)

	def _deadline(self, value):
		try:
			return self.network.to_datetime(self.network.network_timestamp_class(self._uint(value)))
		except (TypeError, ValueError, OverflowError, SymbolNodeUnavailable) as error:
			raise SymbolNodeUnavailable from error

	@staticmethod
	def _mosaic_id(value):
		if isinstance(value, int) and not isinstance(value, bool):
			if value < 0 or value > 0xFFFFFFFFFFFFFFFF:
				raise SymbolNodeUnavailable

			return f'{value:016X}'

		if not isinstance(value, str):
			raise SymbolNodeUnavailable

		try:
			return normalize_mosaic_id(value)
		except (TypeError, ValueError) as error:
			raise SymbolNodeUnavailable from error

	@staticmethod
	def _address_bytes(value):
		if not isinstance(value, str) or len(value) != Address.SIZE * 2 or any(
			character not in '0123456789abcdefABCDEF' for character in value):
			raise SymbolNodeUnavailable

		return Address(bytes.fromhex(value)).bytes

	@classmethod
	def _optional_address(cls, value):
		return None if value in (None, '') else cls._address_bytes(value)
