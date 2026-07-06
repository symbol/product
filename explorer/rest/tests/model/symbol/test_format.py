from datetime import datetime, timezone
from decimal import Decimal
from unittest import TestCase

from rest.model.symbol.format import format_timestamp, format_xym_amount, str_or_none, to_hex, to_hex_or_none


class SymbolFormatTest(TestCase):
	def test_can_format_timestamp(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)

		# Act + Assert:
		self.assertEqual('2026-01-02T03:04:05Z', format_timestamp(timestamp))

	def test_can_format_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', to_hex(bytes.fromhex('0a0b')))

	def test_can_format_optional_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', to_hex_or_none(bytes.fromhex('0a0b')))
		self.assertIsNone(to_hex_or_none(None))

	def test_can_format_optional_string(self):
		# Act + Assert:
		self.assertEqual('123', str_or_none(123))
		self.assertIsNone(str_or_none(None))

	def test_can_format_xym_amount(self):
		# Act + Assert:
		self.assertEqual(1.234567, format_xym_amount(Decimal('1234567')))
