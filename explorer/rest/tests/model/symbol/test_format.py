import os
import time
from datetime import datetime, timedelta, timezone, tzinfo
from decimal import Decimal
from unittest import TestCase

from rest.model.symbol.format import format_amount, format_timestamp, str_or_none, to_hex, to_hex_or_none


class SymbolFormatTest(TestCase):
	def test_can_format_timestamp(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)

		# Act + Assert:
		self.assertEqual('2026-01-02 03:04:05', format_timestamp(timestamp))

	def test_can_format_timestamp_with_offset_as_utc(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 23, 4, 5, 987654, tzinfo=timezone(timedelta(hours=-5)))

		# Act + Assert:
		self.assertEqual('2026-01-03 04:04:05', format_timestamp(timestamp))

	def test_can_format_naive_timestamp_as_utc(self):
		# Act + Assert:
		self.assertEqual('2026-01-02 03:04:05', format_timestamp(datetime(2026, 1, 2, 3, 4, 5, 987654)))

	def test_can_format_timestamp_with_unset_offset_as_utc(self):
		# Arrange:
		class UnsetOffsetTimezone(tzinfo):
			def utcoffset(self, _dt):
				return None

		timestamp = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UnsetOffsetTimezone())

		# Act + Assert:
		self.assertEqual('2026-01-02 03:04:05', format_timestamp(timestamp))

	def test_timestamp_output_is_independent_of_process_timezone(self):
		# Arrange:
		timestamp = datetime(2026, 1, 2, 8, 4, 5, tzinfo=timezone(timedelta(hours=5)))
		original_timezone = os.environ.get('TZ')
		local_hours = []
		outputs = []

		# Act:
		try:
			for timezone_name in ('UTC+08', 'UTC-09'):
				os.environ['TZ'] = timezone_name
				time.tzset()
				local_hours.append(time.localtime(0).tm_hour)
				outputs.append(format_timestamp(timestamp))
				outputs.append(format_timestamp(datetime(2026, 1, 2, 3, 4, 5)))
		finally:
			if original_timezone is None:
				os.environ.pop('TZ', None)
			else:
				os.environ['TZ'] = original_timezone
			time.tzset()

		# Assert:
		self.assertNotEqual(local_hours[0], local_hours[1])
		self.assertEqual([
			'2026-01-02 03:04:05',
			'2026-01-02 03:04:05',
			'2026-01-02 03:04:05',
			'2026-01-02 03:04:05'
		], outputs)

	def test_can_format_none_timestamp_as_none(self):
		# Act + Assert:
		self.assertIsNone(format_timestamp(None))

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

	def test_can_format_amount_with_explicit_divisibility(self):
		# Act + Assert:
		self.assertEqual(1.234567, format_amount(Decimal('1234567'), 6))
