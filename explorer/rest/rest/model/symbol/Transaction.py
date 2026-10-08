from common.symbol.NativeMosaic import normalize_mosaic_id
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from rest.model.symbol.format import format_amount, format_timestamp, to_hex_or_none


class SymbolTransactionView:
	"""Confirmed Symbol transaction view used by Explorer REST responses."""

	def __init__(self, transaction):
		self.transaction = transaction

	def to_dict(self, native_mosaic_info):
		"""Formats the persisted transaction and its display relations."""

		transaction = self.transaction
		value = [self._create_mosaic(mosaic, native_mosaic_info) for mosaic in transaction.mosaics]
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

	@staticmethod
	def _create_mosaic(mosaic, native_mosaic_info):
		mosaic_id = normalize_mosaic_id(mosaic.mosaic_id)
		is_native = mosaic_id == native_mosaic_info.id
		divisibility = native_mosaic_info.divisibility if is_native else mosaic.divisibility
		amount = mosaic.amount if divisibility is None else format_amount(mosaic.amount, divisibility)
		alias_names = mosaic.alias_names or []
		name = alias_names[0] if alias_names else mosaic_id
		return {'id': mosaic_id, 'name': name, 'amount': amount}

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


def _address_to_string(value):
	return str(Address(bytes(value))) if value is not None else None
