from datetime import datetime, timezone
from decimal import Decimal
from unittest import TestCase

from rest.model.symbol.format import format_address, format_amount, format_hex_id, format_timestamp, str_or_none, to_hex, to_hex_or_none


class SymbolFormatTest(TestCase):
	def test_can_format_timestamp(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)

		# Act + Assert:
		self.assertEqual('2026-01-02T03:04:05Z', format_timestamp(timestamp))

	def test_can_format_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', to_hex(bytes.fromhex('0a0b')))

	def test_can_format_text_id(self):
		# Act + Assert:
		self.assertEqual('ABCDEF0123456789', format_hex_id('abcdef0123456789'))

	def test_can_format_optional_id(self):
		# Act + Assert:
		self.assertIsNone(format_hex_id(None))

	def test_can_format_address(self):
		# Act + Assert:
		self.assertEqual(
			'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			format_address(bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')))

	def test_can_format_optional_address(self):
		# Act + Assert:
		self.assertIsNone(format_address(None))

	def test_can_format_optional_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', to_hex_or_none(bytes.fromhex('0a0b')))
		self.assertIsNone(to_hex_or_none(None))

	def test_can_format_optional_string(self):
		# Act + Assert:
		self.assertEqual('123', str_or_none(123))
		self.assertIsNone(str_or_none(None))

	def test_can_format_amount_with_divisibility(self):
		# Act + Assert:
		self.assertEqual(1.234567, format_amount(Decimal('1234567'), 6))

	def test_can_format_amount_with_non_default_divisibility(self):
		# Act + Assert:
		self.assertEqual(12.345, format_amount(Decimal('12345'), 3))
