import unittest

from rest.model.symbol.Mosaic import SymbolMosaicListView


class SymbolMosaicListViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_mosaic_list_view(override=None):
		mosaic_view = SymbolMosaicListView(
			mosaic_id='72C0212E67A08BCE',
			owner_address='TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
			start_height=123,
			expiration_height=579,
			duration=456,
			supply=1234567,
			divisibility=6,
			supply_mutable=False,
			transferable=True,
			restrictable=False,
			revokable=True,
			alias_names=['example', 'example.token']
		)

		if override:
			setattr(mosaic_view, override[0], override[1])

		return mosaic_view

	def test_can_create_mosaic_list_view(self):
		# Act:
		mosaic_view = self._create_default_mosaic_list_view()

		# Assert:
		self.assertEqual('72C0212E67A08BCE', mosaic_view.mosaic_id)
		self.assertEqual('TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ', mosaic_view.owner_address)
		self.assertEqual(123, mosaic_view.start_height)
		self.assertEqual(579, mosaic_view.expiration_height)
		self.assertEqual(456, mosaic_view.duration)
		self.assertEqual(1234567, mosaic_view.supply)
		self.assertEqual(6, mosaic_view.divisibility)
		self.assertIs(False, mosaic_view.supply_mutable)
		self.assertIs(True, mosaic_view.transferable)
		self.assertIs(False, mosaic_view.restrictable)
		self.assertIs(True, mosaic_view.revokable)
		self.assertEqual(['example', 'example.token'], mosaic_view.alias_names)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view()

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertEqual({
			'id': '72C0212E67A08BCE',
			'creator': 'TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
			'aliasNames': ['example', 'example.token'],
			'supply': 1234567,
			'divisibility': 6,
			'registrationHeight': 123,
			'expirationHeight': 579,
			'value': 1.234567,
			'isUnlimitedDuration': False,
			'isSupplyMutable': False,
			'isTransferable': True,
			'isRestrictable': False,
			'isRevokable': True
		}, result_map)

	def test_eq_is_supported(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view()

		# Assert:
		self.assertEqual(mosaic_view, self._create_default_mosaic_list_view())
		self.assertNotEqual(mosaic_view, None)
		self.assertNotEqual(mosaic_view, 'mosaic_view')
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('mosaic_id', '6BED913FA20223F8')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('owner_address', 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('start_height', 124)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('expiration_height', None)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('duration', 0)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('supply', 1234568)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('divisibility', 3)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('supply_mutable', True)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('transferable', False)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('restrictable', True)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('revokable', False)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_list_view(('alias_names', ['example'])))

	def test_can_convert_unlimited_duration(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('duration', 0))
		mosaic_view.expiration_height = None

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertIs(True, result_map['isUnlimitedDuration'])
		self.assertIsNone(result_map['expirationHeight'])

	def test_can_convert_empty_alias_names(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('alias_names', []))

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertEqual([], result_map['aliasNames'])

	def _assert_formatted_supply(self, supply, divisibility, expected_value):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('supply', supply))
		mosaic_view.divisibility = divisibility

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertEqual(supply, result_map['supply'])
		self.assertEqual(divisibility, result_map['divisibility'])
		self.assertEqual(expected_value, result_map['value'])

	def test_can_format_zero_supply(self):
		self._assert_formatted_supply(0, 6, 0.0)

	def test_can_format_supply_with_zero_divisibility(self):
		self._assert_formatted_supply(1234567, 0, 1234567.0)

	def test_can_format_supply_with_maximum_divisibility(self):
		self._assert_formatted_supply(1234567, 6, 1.234567)

	def test_can_convert_mutable_supply(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('supply_mutable', True))

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertIs(True, result_map['isSupplyMutable'])

	def test_can_convert_non_transferable_mosaic(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('transferable', False))

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertIs(False, result_map['isTransferable'])

	def test_can_convert_restrictable_mosaic(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('restrictable', True))

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertIs(True, result_map['isRestrictable'])

	def test_can_convert_non_revokable_mosaic(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_list_view(('revokable', False))

		# Act:
		result_map = mosaic_view.to_dict()

		# Assert:
		self.assertIs(False, result_map['isRevokable'])
