from unittest import TestCase

from puller.model.symbol.Mosaic import create_mosaic_row
from tests.test.SymbolMosaicTestUtils import create_expected_mosaic_row, create_mosaic_item


class MosaicTest(TestCase):
	def test_create_mosaic_row_normalizes_unlimited_duration(self):
		# Arrange:
		item = create_mosaic_item()

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_mosaic_row(item, 123), row)

	def test_create_mosaic_row_retains_raw_payload(self):
		# Arrange:
		item = create_mosaic_item(item_id='A1B2C3D4E5F6071829304A5B')

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_mosaic_row(item, 123), row)

	def test_create_mosaic_row_calculates_finite_expiration_height(self):
		# Arrange:
		item = create_mosaic_item(start_height='412', duration='7')

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_mosaic_row(item, 123, expiration_height=419), row)

	def test_create_mosaic_row_decomposes_combined_flags(self):
		# Arrange:
		item = create_mosaic_item(flags=9)

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual({
			'mosaic_id': item['mosaic']['id'],
			'owner_address': bytes.fromhex(item['mosaic']['ownerAddress']),
			'start_height': 1,
			'duration': 0,
			'expiration_height': None,
			'supply': 8359527600677922,
			'divisibility': 6,
			'flags': 9,
			'supply_mutable': True,
			'transferable': False,
			'restrictable': False,
			'revokable': True,
			'raw_payload': item,
			'updated_at_height': 123
		}, row)
