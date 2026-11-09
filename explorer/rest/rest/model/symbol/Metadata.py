import re

from symbolchain.symbol.Network import Address, Network

from rest.model.symbol.validation import SymbolDataInvalid

HEX_ID = re.compile(r'[0-9A-Fa-f]{16}', re.ASCII)
HEX_VALUE = re.compile(r'(?:[0-9A-Fa-f]{2})*', re.ASCII)


class SymbolMetadataView:
	"""Formats one persisted metadata record without decoding the stored value."""

	def __init__(self, row):
		self.row = row

	def to_dict(self):
		"""Returns the exact public metadata representation."""

		key, target_id, metadata_type, sender, target, value, value_hex = self.row
		if not isinstance(key, str) or not HEX_ID.fullmatch(key):
			raise SymbolDataInvalid('symbol_metadata.scoped_metadata_key', 'invalid metadata key')

		if metadata_type not in ('account', 'mosaic', 'namespace'):
			raise SymbolDataInvalid('symbol_metadata.metadata_type', 'invalid metadata type')

		if metadata_type == 'account':
			if target_id is not None:
				raise SymbolDataInvalid('symbol_metadata.target_id', 'invalid metadata target')
		elif not isinstance(target_id, str) or not HEX_ID.fullmatch(target_id):
			raise SymbolDataInvalid('symbol_metadata.target_id', 'invalid metadata target')

		if not isinstance(value, str) or not isinstance(value_hex, str) or not HEX_VALUE.fullmatch(value_hex):
			raise SymbolDataInvalid('symbol_metadata.value', 'invalid metadata value')

		return {
			'scopedMetadataKey': key.upper(),
			'targetId': target_id.upper() if target_id is not None else None,
			'metadataType': metadata_type,
			'senderAddress': self._address(sender),
			'targetAddress': self._address(target),
			'value': value,
			'valueHex': value_hex.upper()
		}

	@staticmethod
	def _address(value):
		try:
			address = Address(bytes(value))
			if not any(network.is_valid_address(address) for network in Network.NETWORKS):
				raise ValueError('invalid address')

			return str(address)
		except (TypeError, ValueError) as error:
			raise SymbolDataInvalid('symbol_metadata.address', 'invalid metadata address') from error
