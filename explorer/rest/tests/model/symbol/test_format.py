from datetime import datetime, timezone
from decimal import Decimal
from unittest import TestCase

from rest.model.symbol.format import _format_timestamp, _format_total_fee, _hex, _hex_or_none, _str_or_none


class SymbolFormatTest(TestCase):
	def test_can_format_timestamp(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)

		# Act + Assert:
		self.assertEqual('2026-01-02T03:04:05Z', _format_timestamp(timestamp))

	def test_can_format_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', _hex(bytes.fromhex('0a0b')))

	def test_can_format_optional_hex(self):
		# Act + Assert:
		self.assertEqual('0A0B', _hex_or_none(bytes.fromhex('0a0b')))
		self.assertIsNone(_hex_or_none(None))

	def test_can_format_optional_string(self):
		# Act + Assert:
		self.assertEqual('123', _str_or_none(123))
		self.assertIsNone(_str_or_none(None))

	def test_can_format_total_fee(self):
		# Act + Assert:
		self.assertEqual(1.234567, _format_total_fee(Decimal('1234567')))
