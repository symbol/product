from common.symbol.NativeMosaic import normalize_mosaic_id
from symbolchain.symbol.Network import Address

from rest.model.symbol.format import format_amount


class SymbolReceiptView:  # pylint: disable=too-many-instance-attributes
	"""Symbol receipt view used by Explorer REST responses."""

	def __init__(self, **kwargs):
		self.height = kwargs['height']
		self.receipt_type = kwargs['receipt_type']
		self.receipt_group = kwargs['receipt_group']
		self.version = kwargs['version']
		self.sender_address = kwargs['sender_address']
		self.recipient_address = kwargs['recipient_address']
		self.target_address = kwargs['target_address']
		self.mosaic_id = kwargs['mosaic_id']
		self.amount = kwargs['amount']
		self.artifact_id = kwargs['artifact_id']
		self.mosaic_divisibility = kwargs['mosaic_divisibility']

	def to_dict(self, native_mosaic_info):
		"""Formats the receipt as its public JSON representation."""

		mosaic_id = normalize_mosaic_id(self.mosaic_id) if self.mosaic_id is not None else None
		artifact_id = normalize_mosaic_id(self.artifact_id) if self.artifact_id is not None else None
		return {
			'version': self.version,
			'height': self.height,
			'type': self.receipt_type,
			'group': self.receipt_group,
			'targetAddress': _address_to_string(self.target_address),
			'sender': _address_to_string(self.sender_address),
			'to': _address_to_string(self.recipient_address),
			'artifactId': artifact_id,
			'mosaics': [self._create_mosaic(mosaic_id, native_mosaic_info)] if mosaic_id is not None else []
		}

	def _create_mosaic(self, mosaic_id, native_mosaic_info):
		"""Creates the public mosaic amount item for this receipt."""

		is_native = mosaic_id == native_mosaic_info.id
		if is_native:
			amount = format_amount(abs(self.amount), native_mosaic_info.divisibility)
		elif self.mosaic_divisibility is None:
			amount = abs(self.amount)
		else:
			amount = format_amount(abs(self.amount), self.mosaic_divisibility)

		return {
			'id': mosaic_id,
			'name': mosaic_id,
			'amount': amount,
			'isNative': is_native
		}


def _address_to_string(value):
	return str(Address(bytes(value))) if value is not None else None
