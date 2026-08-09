from datetime import datetime, timezone
from unittest import TestCase

from symbolchain.symbol.Network import Network

from puller.model.symbol.format import (
	address_from_public_key,
	bytes_from_hex_or_none,
	camel_case_enum_name,
	decoded_address_bytes_from_hex,
	hash_bytes_from_hex,
	int_or_none,
	is_exact_integer,
	is_hex_text,
	label_for_type,
	str_or_none,
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

	def test_can_convert_optional_str(self):
		# Act + Assert:
		self.assertEqual('123', str_or_none(123))
		self.assertIsNone(str_or_none(None))

	def test_is_hex_text_accepts_lower_and_uppercase_hex_text(self):
		# Arrange:
		value = 'aB0123'

		# Act:
		result = is_hex_text(value)

		# Assert:
		self.assertTrue(result)

	def test_is_hex_text_rejects_non_hex_character(self):
		# Arrange:
		value = '12G3'

		# Act:
		result = is_hex_text(value)

		# Assert:
		self.assertFalse(result)

	def test_is_hex_text_rejects_hex_prefix(self):
		# Arrange:
		value = '0x12'

		# Act:
		result = is_hex_text(value)

		# Assert:
		self.assertFalse(result)

	def test_is_exact_integer_accepts_only_non_boolean_integers(self):
		for value, expected in ((0, True), (-1, True), (True, False), (False, False), ('1', False), (1.0, False)):
			with self.subTest(value=value):
				# Act + Assert:
				self.assertEqual(expected, is_exact_integer(value))

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

	def test_label_for_type_rejects_non_numeric_value(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol widget type abc'):
			label_for_type({1: 'foo'}, 'abc', 'widget')

	def test_can_derive_address_from_public_key(self):
		# Act + Assert:
		self.assertEqual(
			bytes.fromhex(SIGNER_ADDRESS),
			address_from_public_key(bytes.fromhex(SIGNER_PUBLIC_KEY), Network.TESTNET)
		)

	def test_can_decode_address_bytes_from_node_hex(self):
		# Act + Assert:
		self.assertEqual(
			bytes.fromhex(SIGNER_ADDRESS),
			decoded_address_bytes_from_hex({'targetAddress': SIGNER_ADDRESS}, 'targetAddress', 'Symbol test')
		)

	def test_decoded_address_bytes_from_node_hex_rejects_invalid_field(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol test targetAddress$'):
			decoded_address_bytes_from_hex({'targetAddress': 'invalid'}, 'targetAddress', 'Symbol test')
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol test targetAddress$'):
			decoded_address_bytes_from_hex({'targetAddress': '00'}, 'targetAddress', 'Symbol test')

	def test_can_decode_hash_bytes_from_node_hex(self):
		# Act + Assert:
		self.assertEqual(
			bytes.fromhex('AA' * 32),
			hash_bytes_from_hex({'compositeHash': 'AA' * 32}, 'compositeHash', 'Symbol test')
		)

	def test_hash_bytes_from_node_hex_rejects_invalid_field(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol test compositeHash$'):
			hash_bytes_from_hex({'compositeHash': 'invalid'}, 'compositeHash', 'Symbol test')
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol test compositeHash$'):
			hash_bytes_from_hex({'compositeHash': 'AA' * 31}, 'compositeHash', 'Symbol test')
