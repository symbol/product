from unittest import TestCase

from common.symbol.Transaction import parse_message


class MessageTest(TestCase):
	def test_returns_none_when_message_is_none(self):
		self.assertEqual((None, None), parse_message(None))

	def test_returns_none_when_message_is_empty(self):
		self.assertEqual((None, None), parse_message(''))

	def test_returns_plain_message(self):
		self.assertEqual(('plain', '48656c6c6f'), parse_message('0048656c6c6f'))

	def test_returns_plain_message_with_empty_payload(self):
		self.assertEqual(('plain', ''), parse_message('00'))

	def test_returns_encrypted_message(self):
		self.assertEqual(('encrypted', 'abcdef'), parse_message('01abcdef'))

	def test_returns_persistent_delegation_harvesting_message(self):
		self.assertEqual(('persistentDelegationHarvesting', 'abcdef'), parse_message('FE2A8061577301E2abcdef'))

	def test_preserves_message_without_recognized_type(self):
		self.assertEqual((None, '48656c6c6f'), parse_message('48656c6c6f'))

	def test_preserves_message_with_unrecognized_delegation_marker(self):
		self.assertEqual((None, 'FE1234'), parse_message('FE1234'))
