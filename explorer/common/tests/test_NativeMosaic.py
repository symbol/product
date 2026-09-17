from unittest import TestCase

from common.symbol.NativeMosaic import (
	NativeMosaicInfo,
	NativeMosaicValidationError,
	create_native_mosaic_info,
	normalize_divisibility,
	normalize_mosaic_id,
	validate_native_mosaic_response
)


class NativeMosaicTest(TestCase):
	def test_normalize_mosaic_id_accepts_node_and_bare_forms(self):
		# Arrange / Act / Assert:
		self.assertEqual('72C0212E67A08BCE', normalize_mosaic_id("0x72C0'212E'67A0'8BCE"))
		self.assertEqual('72C0212E67A08BCE', normalize_mosaic_id('72c0212e67a08bce'))

	def test_normalize_mosaic_id_rejects_invalid_forms(self):
		# Arrange / Act / Assert:
		for value in ('0x72C0212E67A08BCE', "0x72C0'212E'67A08'BCE", '72C0212E67A08BC', '72C0212E67A08BCG', None):
			with self.assertRaises(NativeMosaicValidationError):
				normalize_mosaic_id(value)

	def test_normalize_divisibility_accepts_integer_forms(self):
		# Arrange / Act / Assert:
		self.assertEqual(6, normalize_divisibility('6'))
		self.assertEqual(0, normalize_divisibility(0))

	def test_normalize_divisibility_rejects_non_integer_or_out_of_range_values(self):
		# Arrange / Act / Assert:
		for value in (True, 6.0, '6.0', -1, 7, None):
			with self.assertRaises(NativeMosaicValidationError):
				normalize_divisibility(value)

	def test_validate_native_mosaic_response_accepts_matching_id(self):
		# Arrange:
		response = {'mosaic': {'id': "0x72C0'212E'67A0'8BCE", 'divisibility': 6}}

		# Act:
		result = validate_native_mosaic_response('72C0212E67A08BCE', response)

		# Assert:
		self.assertEqual(NativeMosaicInfo('72C0212E67A08BCE', 6), result)

	def test_validate_native_mosaic_response_rejects_mismatched_id(self):
		# Arrange:
		response = {'mosaic': {'id': '0000000000000001', 'divisibility': 6}}

		# Act + Assert:
		with self.assertRaises(NativeMosaicValidationError):
			validate_native_mosaic_response('72C0212E67A08BCE', response)

	def test_validate_native_mosaic_response_rejects_missing_divisibility(self):
		# Arrange:
		response = {'mosaic': {'id': '72C0212E67A08BCE'}}

		# Act + Assert:
		with self.assertRaises(NativeMosaicValidationError):
			validate_native_mosaic_response('72C0212E67A08BCE', response)

	def test_create_native_mosaic_info_normalizes_values(self):
		# Arrange / Act:
		result = create_native_mosaic_info('72c0212e67a08bce', '6')

		# Assert:
		self.assertEqual(NativeMosaicInfo('72C0212E67A08BCE', 6), result)
