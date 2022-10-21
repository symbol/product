import unittest

from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import LinkAction, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import NetworkTimestamp

from shoestring.internal.LinkTransactionBuilder import LinkTransactionBuilder

from ..test.TransactionTestUtils import AggregateDescriptor, LinkDescriptor, assert_aggregate_complete_transaction, assert_link_transaction


class LinkTransactionBuilderTest(unittest.TestCase):
	SIGNER_PUBLIC_KEY = PublicKey('1695B400FC0111F56F5630AC7EDDF5F9AAA45EED21B8E400A2C26BEF8E758FCE')

	@staticmethod
	def _create_builder():
		return LinkTransactionBuilder(LinkTransactionBuilderTest.SIGNER_PUBLIC_KEY, 'testnet')

	@staticmethod
	def _hash_transaction(transaction):
		return SymbolFacade('testnet').hash_transaction(transaction)

	@staticmethod
	def _random_public_key():
		return KeyPair(PrivateKey.random()).public_key

	def _assert_aggregate(self, transaction, expected_size):
		assert_aggregate_complete_transaction(self, transaction, AggregateDescriptor(expected_size, 100, 1234, self.SIGNER_PUBLIC_KEY))

	def _assert_link(self, transaction, expected_link_descriptor):
		assert_link_transaction(self, transaction, expected_link_descriptor)

	def test_can_build_aggregate_with_no_links(self):
		# Arrange:
		builder = self._create_builder()

		# Act:
		transaction, transaction_hash = builder.build(NetworkTimestamp(1234), 100)

		# Assert:
		self._assert_aggregate(transaction, 168)
		self.assertEqual(0, len(transaction.transactions))

		self.assertEqual(self._hash_transaction(transaction), transaction_hash)

	def _assert_can_build_aggregate_with_single_link(self, builder_function_accessor, expected_link_descriptor):
		# Arrange:
		builder = self._create_builder()
		builder_function_accessor(builder)(
			expected_link_descriptor.linked_public_key,
			*(expected_link_descriptor.epoch_range or ()))

		# Act:
		transaction, transaction_hash = builder.build(NetworkTimestamp(1234), 100)

		# Assert:
		self._assert_aggregate(transaction, 168 + 48 + 33 + 7 + (8 if expected_link_descriptor.epoch_range else 0))
		self.assertEqual(1, len(transaction.transactions))
		self._assert_link(transaction.transactions[0], expected_link_descriptor)

		self.assertEqual(self._hash_transaction(transaction), transaction_hash)

	def test_can_build_aggregate_with_account_key_link(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.link_account_public_key,
			LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, self._random_public_key(), LinkAction.LINK, None))

	def test_can_build_aggregate_with_account_key_unlink(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.unlink_account_public_key,
			LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, self._random_public_key(), LinkAction.UNLINK, None))

	def test_can_build_aggregate_with_vrf_key_link(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.link_vrf_public_key,
			LinkDescriptor(TransactionType.VRF_KEY_LINK, self._random_public_key(), LinkAction.LINK, None))

	def test_can_build_aggregate_with_vrf_key_unlink(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.unlink_vrf_public_key,
			LinkDescriptor(TransactionType.VRF_KEY_LINK, self._random_public_key(), LinkAction.UNLINK, None))

	def test_can_build_aggregate_with_voting_key_link(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.link_voting_public_key,
			LinkDescriptor(TransactionType.VOTING_KEY_LINK, self._random_public_key(), LinkAction.LINK, (1111, 3344)))

	def test_can_build_aggregate_with_voting_key_unlink(self):
		self._assert_can_build_aggregate_with_single_link(
			lambda builder: builder.unlink_voting_public_key,
			LinkDescriptor(TransactionType.VOTING_KEY_LINK, self._random_public_key(), LinkAction.UNLINK, (1111, 3344)))

	def test_can_build_aggregate_with_all_links(self):
		# Arrange:
		linked_public_keys = [self._random_public_key() for _ in range(6)]

		builder = self._create_builder()
		builder.unlink_account_public_key(linked_public_keys[0])
		builder.unlink_vrf_public_key(linked_public_keys[1])
		builder.unlink_voting_public_key(linked_public_keys[2], 1111, 2222)
		builder.link_account_public_key(linked_public_keys[3])
		builder.link_vrf_public_key(linked_public_keys[4])
		builder.link_voting_public_key(linked_public_keys[5], 3333, 4444)

		# Act:
		transaction, transaction_hash = builder.build(NetworkTimestamp(1234), 100)

		# Assert:
		self._assert_aggregate(transaction, 168 + 6 * 88 + 2 * 8)
		self.assertEqual(6, len(transaction.transactions))
		self._assert_link(
			transaction.transactions[0],
			LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, linked_public_keys[0], LinkAction.UNLINK, None))
		self._assert_link(
			transaction.transactions[1],
			LinkDescriptor(TransactionType.VRF_KEY_LINK, linked_public_keys[1], LinkAction.UNLINK, None))
		self._assert_link(
			transaction.transactions[2],
			LinkDescriptor(TransactionType.VOTING_KEY_LINK, linked_public_keys[2], LinkAction.UNLINK, (1111, 2222)))
		self._assert_link(
			transaction.transactions[3],
			LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, linked_public_keys[3], LinkAction.LINK, None))
		self._assert_link(
			transaction.transactions[4],
			LinkDescriptor(TransactionType.VRF_KEY_LINK, linked_public_keys[4], LinkAction.LINK, None))
		self._assert_link(
			transaction.transactions[5],
			LinkDescriptor(TransactionType.VOTING_KEY_LINK, linked_public_keys[5], LinkAction.LINK, (3333, 4444)))

		self.assertEqual(self._hash_transaction(transaction), transaction_hash)
