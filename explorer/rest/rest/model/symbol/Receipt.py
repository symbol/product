from collections import namedtuple

from rest.model.symbol.format import format_address, format_amount, format_hex_id

ReceiptPosition = namedtuple('ReceiptPosition', ['height', 'id'])
ReceiptPage = namedtuple('ReceiptPage', ['items', 'next_position', 'chain_revision'])


class SymbolReceiptView:
	"""Formats a database receipt row for the Symbol Explorer API."""

	def __init__(self, row, native_mosaic_info):
		self.row = row
		self.native_mosaic_info = native_mosaic_info

	def to_dict(self):
		"""Serializes the receipt using the injected native mosaic contract."""

		mosaic_id = format_hex_id(self.row['mosaic_id'])
		mosaics = []
		if mosaic_id is not None:
			is_native = mosaic_id == self.native_mosaic_info.id
			divisibility = self.native_mosaic_info.divisibility if is_native else self.row['mosaic_divisibility']
			amount = self.row['amount'] if divisibility is None else format_amount(self.row['amount'], divisibility)
			mosaics = [{
				'id': mosaic_id,
				'name': mosaic_id,
				'amount': amount,
				'isNative': is_native
			}]

		return {
			'version': self.row['version'],
			'height': self.row['height'],
			'type': self.row['receipt_type'],
			'group': self.row['receipt_group'],
			'targetAddress': format_address(self.row['target_address']),
			'sender': format_address(self.row['sender_address']),
			'to': format_address(self.row['recipient_address']),
			'artifactId': format_hex_id(self.row['artifact_id']),
			'mosaics': mosaics
		}
