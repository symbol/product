from unittest import TestCase

from puller.model.symbol.format import bytes_from_hex_or_none, int_or_none


class SymbolFormatTest(TestCase):
	def test_can_convert_optional_int(self):
		# Act + Assert:
		self.assertEqual(123, int_or_none('123'))
		self.assertIsNone(int_or_none(None))

	def test_can_convert_optional_hex_bytes(self):
		# Act + Assert:
		self.assertEqual(bytes.fromhex('0a0b'), bytes_from_hex_or_none('0a0b'))
		self.assertIsNone(bytes_from_hex_or_none(None))
		self.assertIsNone(bytes_from_hex_or_none(''))
