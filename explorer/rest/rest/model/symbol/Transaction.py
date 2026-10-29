from collections.abc import Mapping

from common.symbol.NativeMosaic import normalize_mosaic_id
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import (
	AccountRestrictionFlags,
	AliasAction,
	LinkAction,
	MosaicFlags,
	MosaicRestrictionType,
	MosaicSupplyChangeAction,
	TransactionType
)
from symbolchain.symbol.Network import Address

from rest.model.format import format_timestamp
from rest.model.symbol.format import format_amount, to_hex_or_none
from rest.model.symbol.validation import SymbolDataInvalid

UINT64_MAX = (1 << 64) - 1
# Symbol source client/catapult/plugins/txes/mosaic/src/model/MosaicFlags.h at
# dbff03b4096622d1bc1fce611358e05cfa7b0296 defines these four bits.
MOSAIC_DEFINITION_FLAGS = sum(flag.value for flag in (
	MosaicFlags.SUPPLY_MUTABLE, MosaicFlags.TRANSFERABLE, MosaicFlags.RESTRICTABLE, MosaicFlags.REVOKABLE))
SYMBOL_TRANSACTION_DETAIL_REQUIRED_BODY_FIELDS = {
	TransactionType.AGGREGATE_COMPLETE.value: ('transactionsHash',),
	TransactionType.AGGREGATE_BONDED.value: ('transactionsHash',),
	TransactionType.ACCOUNT_KEY_LINK.value: ('linkAction', 'linkedPublicKey'),
	TransactionType.NODE_KEY_LINK.value: ('linkAction', 'linkedPublicKey'),
	TransactionType.VRF_KEY_LINK.value: ('linkAction', 'linkedPublicKey'),
	TransactionType.VOTING_KEY_LINK.value: ('linkAction', 'linkedPublicKey', 'startEpoch', 'endEpoch'),
	TransactionType.HASH_LOCK.value: ('duration', 'hash'),
	TransactionType.SECRET_LOCK.value: ('duration', 'secret', 'hashAlgorithm'),
	TransactionType.SECRET_PROOF.value: ('secret', 'proof', 'hashAlgorithm'),
	TransactionType.ACCOUNT_METADATA.value: ('scopedMetadataKey', 'value', 'valueSizeDelta'),
	TransactionType.MOSAIC_METADATA.value: ('scopedMetadataKey', 'value', 'valueSizeDelta', 'targetMosaicId'),
	TransactionType.NAMESPACE_METADATA.value: ('scopedMetadataKey', 'value', 'valueSizeDelta', 'targetNamespaceId'),
	TransactionType.MOSAIC_DEFINITION.value: ('id', 'divisibility', 'duration', 'nonce', 'flags'),
	TransactionType.MOSAIC_SUPPLY_CHANGE.value: ('mosaicId', 'action', 'delta'),
	TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: ('minApprovalDelta', 'minRemovalDelta', 'addressAdditions', 'addressDeletions'),
	TransactionType.ADDRESS_ALIAS.value: ('namespaceId', 'aliasAction', 'address'),
	TransactionType.MOSAIC_ALIAS.value: ('namespaceId', 'aliasAction', 'mosaicId'),
	TransactionType.NAMESPACE_REGISTRATION.value: ('id', 'name', 'registrationType'),
	TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: ('restrictionFlags', 'restrictionAdditions', 'restrictionDeletions'),
	TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: ('restrictionFlags', 'restrictionAdditions', 'restrictionDeletions'),
	TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: ('restrictionFlags', 'restrictionAdditions', 'restrictionDeletions'),
	TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: ('mosaicId', 'restrictionKey', 'previousRestrictionValue', 'newRestrictionValue'),
	TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: (
		'mosaicId', 'referenceMosaicId', 'restrictionKey', 'previousRestrictionType', 'previousRestrictionValue',
		'newRestrictionType', 'newRestrictionValue')
}
AGGREGATE_TRANSACTION_TYPES = frozenset((
	TransactionType.AGGREGATE_COMPLETE.value,
	TransactionType.AGGREGATE_BONDED.value))


def is_aggregate_transaction_type(transaction_type):
	"""Returns whether a transaction type is an aggregate transaction."""

	return transaction_type in AGGREGATE_TRANSACTION_TYPES


def _hex(value):
	if isinstance(value, bytes):
		if not value:
			raise SymbolDataInvalid('transaction.hex', 'invalid hexadecimal value')

		return value.hex().upper()

	if not isinstance(value, str):
		raise SymbolDataInvalid('transaction.hex', 'invalid hexadecimal value')

	text = value.upper()
	if not text or any(character not in '0123456789ABCDEF' for character in text):
		raise SymbolDataInvalid('transaction.hex', 'invalid hexadecimal value')

	return text


def _hex_or_none(value):
	return _hex(value) if value not in (None, '') else None


def _hex16(value):
	text = _hex(value)
	if len(text) > 16:
		raise SymbolDataInvalid('transaction.hex16', 'value exceeds 16 hexadecimal characters')

	return text.zfill(16)


def _decimal(value, field_path='transaction.decimal'):
	if isinstance(value, bool):
		raise SymbolDataInvalid(field_path, 'expected uint64 decimal value')

	try:
		text = str(value)
	except (TypeError, ValueError, OverflowError):
		raise SymbolDataInvalid(field_path, 'expected uint64 decimal value') from None

	if not text or any(character not in '0123456789' for character in text):
		raise SymbolDataInvalid(field_path, 'expected uint64 decimal value')

	try:
		parsed = int(text)
	except (TypeError, ValueError):
		raise SymbolDataInvalid(field_path, 'expected uint64 decimal value') from None

	if parsed > UINT64_MAX:
		raise SymbolDataInvalid(field_path, 'uint64 value is out of range')

	return text


def _address_value(value):
	if value is None:
		return None

	try:
		if isinstance(value, bytes):
			address = Address(value)
		elif isinstance(value, str) and len(value) == Address.SIZE * 2 and all(
			character in '0123456789abcdefABCDEF' for character in value):
			address = Address(bytes.fromhex(value))
		else:
			raise ValueError
	except (ValueError, TypeError):
		raise SymbolDataInvalid('transaction.address', 'invalid address') from None

	if address.is_alias():
		return f'namespace:{address.to_namespace_id().value:016X}'

	return str(address)


def _enum_name(value, enum_type, names=None):
	try:
		name = enum_type(int(value)).name.lower()
	except (ValueError, TypeError):
		if isinstance(value, str) and value.lower() in {'link', 'unlink'}:
			return value.lower()

		raise SymbolDataInvalid('transaction.enum', 'invalid enum value') from None

	return names.get(name, name) if names else name


def _create_mosaic(mosaic, native_mosaic_info):
	mosaic_id = normalize_mosaic_id(mosaic.mosaic_id)
	is_native = mosaic_id == native_mosaic_info.id
	divisibility = native_mosaic_info.divisibility if is_native else mosaic.divisibility
	amount = mosaic.amount if divisibility is None else format_amount(mosaic.amount, divisibility)
	alias_names = mosaic.alias_names or []
	name = alias_names[0] if alias_names else mosaic_id
	return {'id': mosaic_id, 'name': name, 'amount': amount}


class SymbolTransactionView:
	"""Confirmed Symbol transaction view used by Explorer REST responses."""

	def __init__(self, transaction):
		self.transaction = transaction

	def to_dict(self, native_mosaic_info):
		"""Formats the persisted transaction and its display relations."""

		transaction = self.transaction
		value = [_create_mosaic(mosaic, native_mosaic_info) for mosaic in transaction.mosaics]
		is_embedded = transaction.is_embedded
		sender = _address_to_string(transaction.signer_address)
		return {
			'hash': None if is_embedded else to_hex_or_none(transaction.hash),
			'isEmbedded': is_embedded,
			'aggregateHash': to_hex_or_none(transaction.aggregate_hash) if is_embedded else None,
			'embeddedIndex': transaction.embedded_index if is_embedded else None,
			'group': 'confirmed',
			'height': transaction.height,
			'type': TransactionType(transaction.transaction_type).name,
			'sender': sender,
			'signer': sender,
			'recipient': _address_to_string(transaction.recipient_address),
			'value': value,
			'amount': self._native_transfer_amount(native_mosaic_info),
			'fee': self._fee(native_mosaic_info),
			'timestamp': format_timestamp(transaction.timestamp),
			'message': self._message()
		}

	def _native_transfer_amount(self, native_mosaic_info):
		return sum(
			format_amount(mosaic.amount, native_mosaic_info.divisibility)
			for mosaic in self.transaction.mosaics
			if 'transfer' == mosaic.role and normalize_mosaic_id(mosaic.mosaic_id) == native_mosaic_info.id)

	def _fee(self, native_mosaic_info):
		transaction = self.transaction
		if transaction.is_embedded:
			return None

		return format_amount(transaction.effective_fee, native_mosaic_info.divisibility)

	def _message(self):
		transaction = self.transaction
		if transaction.message_payload is None:
			return None

		payload = transaction.message_payload
		if 'plain' == transaction.message_type:
			try:
				payload = bytes.fromhex(payload).decode('utf-8')
			except UnicodeDecodeError:
				pass

		return {'type': transaction.message_type, 'text': payload}


class SymbolTransactionDetailView:
	"""Formats confirmed, unconfirmed, and partial transaction detail DTOs."""

	TOP_LEVEL_KEYS = (
		'hash', 'isEmbedded', 'aggregateHash', 'embeddedIndex', 'group', 'type', 'version', 'info', 'detail',
		'aggregate', 'hashLock', 'graphic')
	INFO_KEYS = (
		'height', 'timestamp', 'fee', 'value', 'amount', 'maxFee', 'deadline', 'sender', 'recipient',
		'signerPublicKey', 'signature', 'size', 'block')
	TRANSACTION_DETAIL_HANDLERS = {
		TransactionType.TRANSFER.value: '_transfer_detail',
		TransactionType.AGGREGATE_COMPLETE.value: '_aggregate_detail',
		TransactionType.AGGREGATE_BONDED.value: '_aggregate_detail',
		TransactionType.ACCOUNT_KEY_LINK.value: '_key_link_detail',
		TransactionType.NODE_KEY_LINK.value: '_key_link_detail',
		TransactionType.VRF_KEY_LINK.value: '_key_link_detail',
		TransactionType.VOTING_KEY_LINK.value: '_key_link_detail',
		TransactionType.HASH_LOCK.value: '_hash_lock_detail',
		TransactionType.SECRET_LOCK.value: '_secret_lock_detail',
		TransactionType.SECRET_PROOF.value: '_secret_proof_detail',
		TransactionType.ACCOUNT_METADATA.value: '_metadata_detail',
		TransactionType.MOSAIC_METADATA.value: '_metadata_detail',
		TransactionType.NAMESPACE_METADATA.value: '_metadata_detail',
		TransactionType.MOSAIC_DEFINITION.value: '_mosaic_definition_detail',
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: '_supply_change_detail',
		TransactionType.MOSAIC_SUPPLY_REVOCATION.value: '_supply_revocation_detail',
		TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: '_multisig_detail',
		TransactionType.ADDRESS_ALIAS.value: '_alias_detail',
		TransactionType.MOSAIC_ALIAS.value: '_alias_detail',
		TransactionType.NAMESPACE_REGISTRATION.value: '_namespace_registration_detail',
		TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: '_account_restriction_detail',
		TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: '_account_restriction_detail',
		TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: '_account_restriction_detail',
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: '_mosaic_address_restriction_detail',
		TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: '_mosaic_global_restriction_detail'
	}

	def __init__(self, detail, group='confirmed'):
		self.detail = detail
		self.group = group

	def to_dict(self, native_mosaic_info, network):
		"""Returns the exact transaction detail envelope for the selected group."""

		transaction = self.detail.transaction
		is_aggregate = is_aggregate_transaction_type(transaction.transaction_type)
		result = self._to_item(transaction, native_mosaic_info, network, include_envelope=True)
		if is_aggregate:
			children = [
				self._to_item(child, native_mosaic_info, network, include_envelope=False)
				for child in self.detail.children
			]
			result['aggregate'] = {
				'hash': to_hex_or_none(transaction.hash),
				'embeddedTransactions': children,
				'cosignatures': [self._cosignature(item, network) for item in self.detail.cosignatures]
			}
			graphic_transactions = [child['graphic'] for child in children]
		else:
			graphic_transactions = [result['graphic']]

		result['hashLock'] = self._hash_lock(native_mosaic_info)
		result['graphic'] = {'transactions': graphic_transactions}
		return {key: result[key] for key in self.TOP_LEVEL_KEYS}

	def _to_item(self, transaction, native_mosaic_info, network, include_envelope):
		is_embedded = transaction.is_embedded
		is_pending = self.group != 'confirmed'
		transaction_type = self._transaction_type(transaction.transaction_type)
		value = [_create_mosaic(mosaic, native_mosaic_info) for mosaic in transaction.mosaics if mosaic.role != 'metadata_target']
		info = {
			'height': transaction.height,
			'timestamp': None if is_pending else format_timestamp(self.detail.block.timestamp if is_embedded else transaction.timestamp),
			'fee': None if is_pending or is_embedded else format_amount(transaction.effective_fee, native_mosaic_info.divisibility),
			'value': None if is_pending else value,
			'amount': None if is_pending else self._native_transfer_amount(transaction, native_mosaic_info),
			'maxFee': None if is_embedded else format_amount(transaction.max_fee, native_mosaic_info.divisibility),
			'deadline': None if is_embedded else format_timestamp(transaction.deadline),
			'sender': _address_value(transaction.signer_address),
			'recipient': _address_value(transaction.recipient_address),
			'signerPublicKey': to_hex_or_none(transaction.signer_public_key),
			'signature': None if is_embedded else _hex_or_none(transaction.signature),
			'size': None if is_embedded else transaction.size,
			'block': None if self.detail.block is None else self._block()
		}

		detail = self._transaction_detail(transaction, native_mosaic_info, network)
		item = {
			'hash': None if is_embedded else to_hex_or_none(transaction.hash),
			'isEmbedded': is_embedded,
			'aggregateHash': to_hex_or_none(transaction.aggregate_hash) if is_embedded else None,
			'embeddedIndex': transaction.embedded_index if is_embedded else None,
			'group': self.group,
			'type': transaction_type.name,
			'version': transaction.version,
			'info': {key: info[key] for key in self.INFO_KEYS},
			'detail': detail,
			'graphic': self._graphic_item(transaction, detail)
		}
		if include_envelope:
			item['aggregate'] = None
			item['hashLock'] = None

		return item

	@staticmethod
	def _transaction_type(value):
		try:
			return TransactionType(value)
		except (ValueError, TypeError):
			raise SymbolDataInvalid('transaction.type', 'unsupported transaction type') from None

	def _block(self):
		block = self.detail.block
		return {
			'height': block.height,
			'hash': to_hex_or_none(block.hash),
			'timestamp': format_timestamp(block.timestamp),
			'feeMultiplier': block.fee_multiplier
		}

	@staticmethod
	def _native_transfer_amount(transaction, native_mosaic_info):
		if is_aggregate_transaction_type(transaction.transaction_type):
			return 0

		return sum(
			format_amount(mosaic.amount, native_mosaic_info.divisibility)
			for mosaic in transaction.mosaics
			if mosaic.role == 'transfer' and normalize_mosaic_id(mosaic.mosaic_id) == native_mosaic_info.id)

	def _transaction_detail(self, transaction, native_mosaic_info, network):
		if not isinstance(transaction.body, Mapping):
			raise SymbolDataInvalid('transaction.body', 'expected object')

		if not isinstance(transaction.raw_payload, Mapping) or not isinstance(transaction.raw_payload.get('transaction'), Mapping):
			raise SymbolDataInvalid('transaction.rawPayload.transaction', 'expected object')

		body = transaction.body
		raw_transaction = transaction.raw_payload['transaction']
		for field_path, network_value in (
			('transaction.body.network', body.get('network')),
			('transaction.rawPayload.transaction.network', raw_transaction.get('network'))):
			if isinstance(network_value, bool) or not isinstance(network_value, (int, str)):
				raise SymbolDataInvalid(field_path, 'network does not match configured network')

			if isinstance(network_value, str) and (not network_value or not network_value.isdecimal()):
				raise SymbolDataInvalid(field_path, 'network does not match configured network')

			try:
				parsed_network = int(network_value)
			except (TypeError, ValueError):
				raise SymbolDataInvalid(field_path, 'network does not match configured network') from None

			if parsed_network != network.identifier:
				raise SymbolDataInvalid(field_path, 'network does not match configured network')

		if not isinstance(transaction.version, int) or isinstance(transaction.version, bool):
			raise SymbolDataInvalid('transaction.version', 'expected integer')

		if not transaction.is_embedded:
			signature = transaction.raw_payload['transaction'].get('signature')
			if not self._is_fixed_hex(signature, 128):
				raise SymbolDataInvalid('transaction.signature', 'invalid signature')

		transaction_type = transaction.transaction_type
		self._validate_body(transaction_type, body)
		mosaics = [_create_mosaic(mosaic, native_mosaic_info) for mosaic in transaction.mosaics]
		handler_name = self.TRANSACTION_DETAIL_HANDLERS.get(transaction_type)
		handler = getattr(self, handler_name) if handler_name else None
		return handler(transaction, body, mosaics, network)

	@staticmethod
	def _transfer_detail(transaction, _body, mosaics, _network):
		return {
			'recipient': _address_value(transaction.recipient_address),
			'mosaics': mosaics,
			'message': SymbolTransactionDetailView._message(transaction)
		}

	@classmethod
	def _aggregate_detail(cls, _transaction, body, _mosaics, _network):
		return {'transactionsHash': cls._required_hex(body.get('transactionsHash'), 64, 'transaction.transactionsHash')}

	def _key_link_detail(self, transaction, body, _mosaics, network):
		result = {
			'linkAction': _enum_name(body.get('linkAction'), LinkAction, {'link': 'link', 'unlink': 'unlink'}),
			'linkedPublicKey': self._required_hex(body.get('linkedPublicKey'), 64, 'transaction.linkedPublicKey'),
			'linkedAccountAddress': self._linked_account_address(body.get('linkedPublicKey'), network)
		}
		if transaction.transaction_type == TransactionType.VOTING_KEY_LINK.value:
			result.update({
				'startEpoch': body.get('startEpoch'),
				'endEpoch': body.get('endEpoch')
			})

		return result

	@classmethod
	def _hash_lock_detail(cls, _transaction, body, mosaics, _network):
		return {
			'mosaics': mosaics,
			'duration': _decimal(body.get('duration')),
			'hash': cls._required_hex(body.get('hash'), 64, 'transaction.hash')
		}

	@classmethod
	def _secret_lock_detail(cls, transaction, body, mosaics, _network):
		return {
			'mosaics': mosaics,
			'recipient': _address_value(transaction.recipient_address),
			'duration': _decimal(body.get('duration')),
			'secret': cls._required_hex(body.get('secret'), 64, 'transaction.secret'),
			'hashAlgorithm': cls._hash_algorithm(body.get('hashAlgorithm'))
		}

	@classmethod
	def _secret_proof_detail(cls, transaction, body, _mosaics, _network):
		return {
			'recipient': _address_value(transaction.recipient_address),
			'secret': cls._required_hex(body.get('secret'), 64, 'transaction.secret'),
			'proof': _hex_or_none(body.get('proof')),
			'hashAlgorithm': cls._hash_algorithm(body.get('hashAlgorithm'))
		}

	@classmethod
	def _mosaic_definition_detail(cls, _transaction, body, _mosaics, _network):
		flags = body.get('flags')
		return {
			'mosaicId': _hex16(body.get('id')),
			'divisibility': body.get('divisibility'),
			'duration': _decimal(body.get('duration')),
			'nonce': body.get('nonce'),
			'supplyMutable': bool(flags & MosaicFlags.SUPPLY_MUTABLE.value),
			'transferable': bool(flags & MosaicFlags.TRANSFERABLE.value),
			'restrictable': bool(flags & MosaicFlags.RESTRICTABLE.value),
			'revokable': bool(flags & MosaicFlags.REVOKABLE.value)
		}

	@classmethod
	def _supply_change_detail(cls, transaction, body, _mosaics, _network):
		mosaic = cls._mosaic_for_role(transaction, 'definition')
		return {
			'mosaicId': _hex16(mosaic.mosaic_id),
			'action': cls._supply_action(body.get('action')),
			'delta': _decimal(body.get('delta'))
		}

	@staticmethod
	def _supply_revocation_detail(transaction, _body, mosaics, _network):
		return {
			'address': _address_value(transaction.source_address),
			'mosaics': mosaics
		}

	@staticmethod
	def _multisig_detail(_transaction, body, _mosaics, _network):
		return {
			'minApprovalDelta': body.get('minApprovalDelta'),
			'minRemovalDelta': body.get('minRemovalDelta'),
			'addressAdditions': SymbolTransactionDetailView._address_array(body.get('addressAdditions', [])),
			'addressDeletions': SymbolTransactionDetailView._address_array(body.get('addressDeletions', []))
		}

	@classmethod
	def _namespace_registration_detail(cls, _transaction, body, _mosaics, _network):
		registration_type = cls._registration_type(body.get('registrationType'))
		return {
			'namespaceId': _hex16(body.get('id')),
			'namespaceName': body.get('name'),
			'registrationType': registration_type,
			'parentId': _hex16(body.get('parentId')) if registration_type == 'sub' else None,
			'duration': _decimal(body.get('duration')) if registration_type == 'root' else None
		}

	@classmethod
	def _validate_body(cls, transaction_type, body):  # pylint: disable=too-many-branches
		for field in SYMBOL_TRANSACTION_DETAIL_REQUIRED_BODY_FIELDS.get(transaction_type, ()):
			if field not in body or body[field] is None:
				raise SymbolDataInvalid(f'transaction.body.{field}', 'missing required field')

		if transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			registration_type = cls._registration_type(body.get('registrationType'))
			if registration_type == 'root':
				if body.get('duration') is None:
					raise SymbolDataInvalid('transaction.body.duration', 'missing required field')

				if body.get('parentId') not in (None, ''):
					raise SymbolDataInvalid('transaction.body.parentId', 'field is not applicable')

			if registration_type == 'sub':
				if body.get('parentId') is None:
					raise SymbolDataInvalid('transaction.body.parentId', 'missing required field')

				if body.get('duration') not in (None, ''):
					raise SymbolDataInvalid('transaction.body.duration', 'field is not applicable')

		if transaction_type == TransactionType.VOTING_KEY_LINK.value:
			for field in ('startEpoch', 'endEpoch'):
				cls._validate_integer(body.get(field), 0, 0xFFFFFFFF, f'transaction.body.{field}')

		if transaction_type == TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value:
			for field in ('minApprovalDelta', 'minRemovalDelta'):
				cls._validate_integer(body.get(field), -128, 127, f'transaction.body.{field}')

		if transaction_type in (
			TransactionType.ACCOUNT_METADATA.value, TransactionType.MOSAIC_METADATA.value, TransactionType.NAMESPACE_METADATA.value):
			cls._validate_integer(body.get('valueSizeDelta'), -32768, 32767, 'transaction.body.valueSizeDelta')

		if transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			cls._validate_integer(body.get('divisibility'), 0, 255, 'transaction.body.divisibility')
			cls._validate_integer(body.get('nonce'), 0, 0xFFFFFFFF, 'transaction.body.nonce')
			flags = body.get('flags')
			if isinstance(flags, bool) or not isinstance(flags, int):
				raise SymbolDataInvalid('transaction.body.flags', 'expected integer')

			if flags < 0 or flags & ~MOSAIC_DEFINITION_FLAGS:
				raise SymbolDataInvalid('transaction.body.flags', 'invalid flags')

	def _metadata_detail(self, transaction, body, _mosaics, _network):
		result = {
			'targetAddress': _address_value(transaction.target_address),
			'scopedMetadataKey': _hex16(body.get('scopedMetadataKey')),
			'valueDelta': _hex_or_none(body.get('value')),
			'valueSizeDelta': body.get('valueSizeDelta')
		}
		if transaction.transaction_type == TransactionType.MOSAIC_METADATA.value:
			target_mosaic = self._mosaic_for_role(transaction, 'metadata_target')
			result.update({
				'targetMosaicId': _hex16(target_mosaic.mosaic_id),
				'targetMosaicAliasNames': list(target_mosaic.alias_names or [])
			})

		if transaction.transaction_type == TransactionType.NAMESPACE_METADATA.value:
			result.update({
				'targetNamespaceId': _hex16(body.get('targetNamespaceId')),
				'namespaceName': self._namespace_name(body.get('targetNamespaceId'))
			})

		return result

	def _alias_detail(self, transaction, body, _mosaics, _network):
		result = {
			'namespaceId': _hex16(body.get('namespaceId')),
			'namespaceName': self._namespace_name(body.get('namespaceId')),
			'aliasAction': self._alias_action(body.get('aliasAction'))
		}
		if transaction.transaction_type == TransactionType.ADDRESS_ALIAS.value:
			result['address'] = _address_value(body.get('address'))
		else:
			result['mosaicId'] = _hex16(body.get('mosaicId'))

		return result

	def _account_restriction_detail(self, transaction, body, _mosaics, _network):
		transaction_type = transaction.transaction_type
		result = {
			'restrictionFlags': body.get('restrictionFlags'),
			'restrictionType': self._restriction_type(body.get('restrictionFlags'), transaction_type)
		}
		field = {
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: ('restrictionAddressAdditions', 'restrictionAddressDeletions'),
			TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: ('restrictionMosaicAdditions', 'restrictionMosaicDeletions'),
			TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: ('restrictionOperationAdditions', 'restrictionOperationDeletions')
		}[transaction_type]
		if transaction_type == TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value:
			values = (self._address_array(body.get('restrictionAdditions', [])), self._address_array(body.get('restrictionDeletions', [])))
		elif transaction_type == TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value:
			values = (self._mosaic_array(body.get('restrictionAdditions', [])), self._mosaic_array(body.get('restrictionDeletions', [])))
		else:
			values = (self._operation_array(body.get('restrictionAdditions', [])), self._operation_array(body.get('restrictionDeletions', [])))

		result[field[0]], result[field[1]] = values
		return result

	def _mosaic_address_restriction_detail(self, transaction, body, _mosaics, _network):
		mosaic = self._mosaic_for_role(transaction, 'restriction')
		return {
			'mosaicId': _hex16(mosaic.mosaic_id),
			'mosaicAliasNames': list(mosaic.alias_names or []),
			'targetAddress': _address_value(transaction.target_address),
			'restrictionKey': _hex16(body.get('restrictionKey')),
			'previousRestrictionValue': _decimal(body.get('previousRestrictionValue')),
			'newRestrictionValue': _decimal(body.get('newRestrictionValue'))
		}

	def _mosaic_global_restriction_detail(self, transaction, body, _mosaics, _network):
		restriction_mosaics = [mosaic for mosaic in transaction.mosaics if mosaic.role == 'restriction']
		if not restriction_mosaics:
			raise SymbolDataInvalid('transaction.mosaics.restriction', 'missing required mosaic relation')

		reference_mosaic_id = body.get('referenceMosaicId')
		if reference_mosaic_id not in (None, '0', '00', '0000000000000000'):
			position_one = next((mosaic for mosaic in restriction_mosaics if mosaic.position == 1), None)
			if position_one is not None:
				reference_mosaic_id = position_one.mosaic_id
			elif self.group == 'confirmed':
				raise SymbolDataInvalid('transaction.mosaics.restriction', 'missing resolved reference mosaic relation')

		return {
			'mosaicId': _hex16(restriction_mosaics[0].mosaic_id),
			'referenceMosaicId': _hex16(reference_mosaic_id),
			'mosaicAliasNames': list(restriction_mosaics[0].alias_names or []),
			'restrictionKey': _hex16(body.get('restrictionKey')),
			'previousRestrictionType': SymbolTransactionDetailView._restriction_compare_type(body.get('previousRestrictionType')),
			'previousRestrictionValue': _decimal(body.get('previousRestrictionValue')),
			'newRestrictionType': SymbolTransactionDetailView._restriction_compare_type(body.get('newRestrictionType')),
			'newRestrictionValue': _decimal(body.get('newRestrictionValue'))
		}

	@staticmethod
	def _message(transaction):
		if transaction.message_payload in (None, '') and transaction.message_type is None:
			return None

		payload = transaction.message_payload
		if transaction.message_type == 'plain':
			try:
				payload = bytes.fromhex(payload).decode('utf-8')
			except (UnicodeDecodeError, ValueError):
				pass

		return {'type': transaction.message_type, 'text': payload}

	@staticmethod
	def _graphic_item(transaction, detail):
		sender = _address_value(transaction.signer_address)
		recipient = detail.get('recipient') if isinstance(detail, Mapping) else None
		if transaction.transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value:
			sender = detail.get('address')
			recipient = _address_value(transaction.signer_address)
		elif transaction.transaction_type == TransactionType.ADDRESS_ALIAS.value:
			recipient = detail.get('address')

		return {
			'type': TransactionType(transaction.transaction_type).name,
			'sender': sender,
			'recipient': recipient,
			'detail': detail
		}

	def _hash_lock(self, native_mosaic_info):
		lock = self.detail.hash_lock
		if lock is None:
			return None

		mosaic_id = normalize_mosaic_id(lock.mosaic_id)
		is_native = mosaic_id == native_mosaic_info.id
		divisibility = native_mosaic_info.divisibility if is_native else lock.divisibility
		amount = lock.amount if divisibility is None else format_amount(lock.amount, divisibility)
		name = (lock.alias_names or [mosaic_id])[0]
		return {
			'transactionHash': to_hex_or_none(lock.hash),
			'ownerAddress': _address_value(lock.owner_address),
			'endHeight': lock.end_height,
			'status': lock.status,
			'mosaics': [{
				'id': mosaic_id,
				'name': name,
				'amount': amount,
				'isNative': is_native
			}]
		}

	def _cosignature(self, item, network):
		if not isinstance(item, Mapping) or item.get('signerPublicKey') is None or item.get('signature') is None:
			raise SymbolDataInvalid('transaction.cosignatures', 'invalid cosignature')

		signer_public_key = self._required_hex(item['signerPublicKey'], 64, 'transaction.cosignatures.signerPublicKey')
		signer = network.public_key_to_address(PublicKey(bytes.fromhex(signer_public_key)))
		return {
			'signer': str(signer),
			'signature': self._required_hex(item['signature'], 128, 'transaction.cosignatures.signature')
		}

	def _linked_account_address(self, value, network):
		public_key = self._required_hex(value, 64, 'transaction.linkedPublicKey')
		return str(network.public_key_to_address(PublicKey(bytes.fromhex(public_key))))

	def _namespace_name(self, namespace_id):
		return self.detail.namespace_names.get(str(namespace_id).upper()) if namespace_id is not None else None

	@staticmethod
	def _mosaic_for_role(transaction, role):
		for mosaic in transaction.mosaics:
			if mosaic.role == role:
				return mosaic

		raise SymbolDataInvalid(f'transaction.mosaics.{role}', 'missing required mosaic relation')

	@staticmethod
	def _is_fixed_hex(value, width):
		return isinstance(value, str) and len(value) == width and all(
			character in '0123456789abcdefABCDEF' for character in value)

	@classmethod
	def _required_hex(cls, value, width, field_path):
		if not cls._is_fixed_hex(value, width):
			raise SymbolDataInvalid(field_path, f'expected {width}-character hexadecimal value')

		return value.upper()

	@staticmethod
	def _address_array(values):
		if not isinstance(values, list):
			raise SymbolDataInvalid('transaction.addresses', 'expected array')

		return [_address_value(value) for value in values]

	@staticmethod
	def _mosaic_array(values):
		if not isinstance(values, list):
			raise SymbolDataInvalid('transaction.mosaics', 'expected array')

		return [_hex16(value) for value in values]

	@staticmethod
	def _operation_array(values):
		if not isinstance(values, list):
			raise SymbolDataInvalid('transaction.operations', 'expected array')

		result = []
		for value in values:
			if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 0xFFFF:
				raise SymbolDataInvalid('transaction.restrictionAdditions', 'invalid transaction type')

			try:
				result.append(TransactionType(value).name)
			except (ValueError, TypeError):
				raise SymbolDataInvalid('transaction.restrictionAdditions', 'invalid transaction type') from None

		return result

	@staticmethod
	def _validate_integer(value, minimum, maximum, field_path):
		if isinstance(value, bool) or not isinstance(value, int) or value < minimum or value > maximum:
			raise SymbolDataInvalid(field_path, 'expected integer in range')

	@staticmethod
	def _restriction_type(flags, transaction_type):
		try:
			flags = flags.value if isinstance(flags, AccountRestrictionFlags) else int(flags)
		except (ValueError, TypeError):
			raise SymbolDataInvalid('transaction.restrictionFlags', 'invalid flags') from None

		kind = {
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: 'Address',
			TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: 'Mosaic',
			TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: 'Operation'
		}[transaction_type]
		known = sum(flag.value for flag in (
			AccountRestrictionFlags.ADDRESS,
			AccountRestrictionFlags.MOSAIC_ID,
			AccountRestrictionFlags.TRANSACTION_TYPE,
			AccountRestrictionFlags.OUTGOING,
			AccountRestrictionFlags.BLOCK
		))
		kind_flag = {
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: AccountRestrictionFlags.ADDRESS.value,
			TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: AccountRestrictionFlags.MOSAIC_ID.value,
			TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: AccountRestrictionFlags.TRANSACTION_TYPE.value
		}[transaction_type]
		kind_mask = (
			AccountRestrictionFlags.ADDRESS | AccountRestrictionFlags.MOSAIC_ID | AccountRestrictionFlags.TRANSACTION_TYPE).value
		if flags & ~known or flags & kind_mask != kind_flag:
			raise SymbolDataInvalid('transaction.restrictionFlags', 'invalid flags')

		permission = 'Block' if flags & AccountRestrictionFlags.BLOCK.value else 'Allow'
		direction = 'Outgoing' if flags & AccountRestrictionFlags.OUTGOING.value else 'Incoming'
		return f'{permission} {direction} {kind}'

	@staticmethod
	def _restriction_compare_type(value):
		try:
			return MosaicRestrictionType(int(value)).name
		except (ValueError, TypeError):
			raise SymbolDataInvalid('transaction.restrictionType', 'invalid restriction type') from None

	@staticmethod
	def _hash_algorithm(value):
		if value in ('sha3_256', 'hash160', 'hash256'):
			return value

		try:
			return {0: 'sha3_256', 1: 'hash160', 2: 'hash256'}[int(value)]
		except (KeyError, ValueError, TypeError):
			raise SymbolDataInvalid('transaction.hashAlgorithm', 'invalid hash algorithm') from None

	@staticmethod
	def _supply_action(value):
		if value in ('increase', 'decrease'):
			return value

		try:
			return MosaicSupplyChangeAction(int(value)).name.lower()
		except (ValueError, TypeError):
			raise SymbolDataInvalid('transaction.action', 'invalid supply action') from None

	@staticmethod
	def _alias_action(value):
		if value in ('link', 'unlink'):
			return value

		try:
			return AliasAction(int(value)).name.lower()
		except (ValueError, TypeError):
			raise SymbolDataInvalid('transaction.aliasAction', 'invalid alias action') from None

	@staticmethod
	def _registration_type(value):
		if value in (1, 'child', 'sub'):
			return 'sub'

		if value in (0, 'root'):
			return 'root'

		raise SymbolDataInvalid('transaction.registrationType', 'invalid registration type')


def _address_to_string(value):
	return str(Address(bytes(value))) if value is not None else None
