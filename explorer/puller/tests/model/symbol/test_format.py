from datetime import datetime, timezone
from unittest import TestCase

from symbolchain.symbol.Network import Network

from puller.model.symbol.format import (
	address_from_public_key,
	bytes_from_hex_or_none,
	camel_case_enum_name,
	int_or_none,
	label_for_type,
	timestamp_from_network_value
)
from tests.test.SymbolTestConstants import SIGNER_ADDRESS, SIGNER_PUBLIC_KEY


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

	def test_can_camel_case_multi_word_enum_name(self):
		# Act + Assert:
		self.assertEqual('mosaicDefinition', camel_case_enum_name('MOSAIC_DEFINITION'))

	def test_can_camel_case_single_word_enum_name(self):
		# Act + Assert:
		self.assertEqual('transfer', camel_case_enum_name('TRANSFER'))

	def test_can_convert_network_timestamp_value(self):
		# Act + Assert:
		self.assertEqual(datetime.fromtimestamp(101, timezone.utc), timestamp_from_network_value(1000, 100))

	def test_can_look_up_label_for_type(self):
		# Act + Assert:
		self.assertEqual('foo', label_for_type({1: 'foo'}, 1, 'widget'))

	def test_label_for_type_rejects_unsupported_value(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol widget type 99'):
			label_for_type({1: 'foo'}, 99, 'widget')

	def test_can_derive_address_from_public_key(self):
		# Act + Assert:
		self.assertEqual(
			bytes.fromhex(SIGNER_ADDRESS),
			address_from_public_key(bytes.fromhex(SIGNER_PUBLIC_KEY), Network.TESTNET)
		)
