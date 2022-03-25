import unittest

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network

from puller.processors.RequestGrouper import RequestType, group_requests

from ..test.OptinRequestTestUtils import NEM_ADDRESSES, PUBLIC_KEYS, assert_equal_request, make_request


class RequestGrouperTest(unittest.TestCase):
	def _assert_grouped_request(self, grouped_requests, index_or_address, expected_requests, **kwargs):
		disposition = kwargs.get('disposition', RequestType.NORMAL)
		if isinstance(index_or_address, Address):
			source_address = index_or_address
		else:
			index = index_or_address
			if disposition & RequestType.MULTISIG:
				source_address = Network.TESTNET.public_key_to_address(PublicKey(PUBLIC_KEYS[index]))
			else:
				source_address = Address(NEM_ADDRESSES[index])

		grouped_request = grouped_requests[source_address]
		self.assertEqual(disposition, grouped_request.disposition)
		self.assertEqual(kwargs.get('is_error', False), grouped_request.is_error)

		self.assertEqual(len(expected_requests), len(grouped_request.requests))
		for i, expected_request in enumerate(expected_requests):
			assert_equal_request(self, expected_request, grouped_request.requests[i])

	# region normal

	def test_can_process_normal_requests_without_duplicates(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(3, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 0, [original_requests[0]])
		self._assert_grouped_request(grouped_requests, 1, [original_requests[1]])
		self._assert_grouped_request(grouped_requests, 2, [original_requests[2]])

	def test_can_process_normal_requests_with_duplicates(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]}, address_index=0)
		]

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert: first duplicate was retained
		self.assertEqual(2, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 0, [original_requests[0]])
		self._assert_grouped_request(grouped_requests, 1, [original_requests[1]])

	# endregion

	# region multisig

	def test_can_process_multisig_requests_without_duplicates(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]})
		]

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(2, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 3, [original_requests[0], original_requests[2]], disposition=RequestType.MULTISIG)
		self._assert_grouped_request(grouped_requests, 4, [original_requests[1]], disposition=RequestType.MULTISIG)

	def test_can_process_multisig_requests_with_duplicate_addresses_in_different_scope(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}, address_index=0),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]})
		]

		# Sanity:
		self.assertEqual(original_requests[0].address, original_requests[1].address)

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(2, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 3, [original_requests[0], original_requests[2]], disposition=RequestType.MULTISIG)
		self._assert_grouped_request(grouped_requests, 4, [original_requests[1]], disposition=RequestType.MULTISIG)

	def test_can_process_multisig_requests_with_duplicate_addresses_in_same_scope(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}, address_index=0)
		]

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert: first duplicate was retained
		self.assertEqual(2, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 3, [original_requests[0]], disposition=RequestType.MULTISIG)
		self._assert_grouped_request(grouped_requests, 4, [original_requests[1]], disposition=RequestType.MULTISIG)

	# endregion

	# region errors

	def test_cannot_process_multisig_requests_with_inconsistent_destination(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[3]})
		]

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(2, len(grouped_requests))
		self._assert_grouped_request(grouped_requests, 3, [original_requests[0]], disposition=RequestType.MULTISIG, is_error=True)
		self._assert_grouped_request(grouped_requests, 4, [original_requests[1]], disposition=RequestType.MULTISIG)

	def test_can_process_requests_with_inconsistent_type_multisig_first(self):
		# Arrange:
		original_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[1]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[1]})
		]
		original_requests[1].address = Network.TESTNET.public_key_to_address(PublicKey(PUBLIC_KEYS[1]))  # set to multisig origin

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(1, len(grouped_requests))
		self._assert_grouped_request(
			grouped_requests,
			1,
			[original_requests[0], original_requests[2]],
			disposition=RequestType.NORMAL | RequestType.MULTISIG)

	def test_can_process_requests_with_inconsistent_type_normal_first(self):
		# Arrange:
		original_requests = [
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[1]})
		]
		original_requests[0].address = Network.TESTNET.public_key_to_address(PublicKey(PUBLIC_KEYS[1]))  # set to multisig origin

		# Act:
		grouped_requests = group_requests(Network.TESTNET, original_requests)

		# Assert:
		self.assertEqual(1, len(grouped_requests))
		self._assert_grouped_request(
			grouped_requests,
			original_requests[0].address,
			[original_requests[0], original_requests[1], original_requests[2]],
			disposition=RequestType.NORMAL | RequestType.MULTISIG)

	# endregion
