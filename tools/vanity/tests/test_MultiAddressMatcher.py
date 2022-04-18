import unittest
from collections import namedtuple

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Address, Network

from vanity.MultiAddressMatcher import MultiAddressMatcher

MatchTuple = namedtuple('MatchTuple', ['private_key', 'address'])


START_MATCH = MatchTuple(
	PrivateKey('6A7AFB9D77C98AEE2029A9DBF37D1356D6DCF841D5DFBEE55FD39E219EDB7A65'),
	Address('TAXEYNYRRJVLIW4I36DPV2R2A63SJNOHRTZAG4Q'))

MID_MATCH = MatchTuple(
	PrivateKey('807E3FC290E28EE0986C61AD249B0B1941196D762DA6BEBA38C703224E17C818'),
	Address('TB4A7FJ262IGWXFPNDFTAXEY3POZ56SWQ34FG5Y'))

END_MATCH = MatchTuple(
	PrivateKey('61C1ECE14DF33FC8E8364CB065B22E426B472140BAEBDC090B022006A9C00975'),
	Address('TCS3URII5D4E2IP4I6K5WIDSGN7GOZXDQXTAXEY'))


class MultiAddressMatcherTest(unittest.TestCase):
	# region constructor / add_search_pattern

	def test_can_create_matcher(self):
		# Act:
		matcher = MultiAddressMatcher(Network.TESTNET, 100)

		# Assert:
		self.assertTrue(matcher.is_complete)

	def test_can_add_search_pattern(self):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, 100)

		# Act:
		matcher.add_search_pattern('AXE')

		# Assert:
		self.assertFalse(matcher.is_complete)

	# endregion

	# region accept - fully matching

	def _assert_can_accept_fully_matching_pattern(self, pattern, max_offset, match_tuple):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, max_offset)
		matcher.add_search_pattern(pattern)

		# Act:
		result = matcher.accept(KeyPair(match_tuple.private_key))

		# Assert:
		self.assertTrue(matcher.is_complete)
		self.assertTrue(result[1])
		self.assertEqual(match_tuple.address, Network.TESTNET.public_key_to_address(result[0].public_key))

	def test_can_accept_fully_matching_pattern(self):
		self._assert_can_accept_fully_matching_pattern('AXE', 100, MID_MATCH)

	def test_can_accept_fully_matching_pattern_start(self):
		self._assert_can_accept_fully_matching_pattern('TAXE', 0, START_MATCH)

	# endregion

	# region accept - partial matching

	def _assert_can_accept_partial_matching_pattern(self, pattern, max_offset, match_tuple):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, max_offset)
		matcher.add_search_pattern(pattern)

		# Act:
		result = matcher.accept(KeyPair(match_tuple.private_key))

		# Assert:
		self.assertFalse(matcher.is_complete)
		self.assertFalse(result[1])
		self.assertEqual(match_tuple.address, Network.TESTNET.public_key_to_address(result[0].public_key))

	def test_can_accept_partial_matching_pattern(self):
		self._assert_can_accept_partial_matching_pattern('AXING', 100, MID_MATCH)

	def test_can_accept_partial_matching_pattern_start(self):
		self._assert_can_accept_partial_matching_pattern('TAXING', 0, START_MATCH)

	# endregion

	# region accept - unmatched

	def _assert_cannot_accept_unmatched_pattern(self, pattern, max_offset, private_key):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, max_offset)
		matcher.add_search_pattern(pattern)

		# Act:
		result = matcher.accept(KeyPair(private_key))

		# Assert:
		self.assertFalse(matcher.is_complete)
		self.assertFalse(result[1])
		self.assertEqual(None, result[0])

	def test_cannot_accept_unmatched_pattern(self):
		self._assert_cannot_accept_unmatched_pattern('999', 100, MID_MATCH.private_key)

	def test_cannot_accept_unmatched_pattern_start(self):
		self._assert_cannot_accept_unmatched_pattern('AXE', 0, START_MATCH.private_key)

	def test_cannot_accept_matched_pattern_starting_after_max_offset(self):
		self._assert_cannot_accept_unmatched_pattern('AXE', 2, MID_MATCH.private_key)

	# endregion

	# region progressive matching (and progress_monitor)

	def test_can_accept_better_match(self):
		# Arrange:
		progress_lines = []
		matcher = MultiAddressMatcher(Network.TESTNET, 100, progress_lines.append)
		matcher.add_search_pattern('AXEY3')

		# Act:
		result1 = matcher.accept(KeyPair(START_MATCH.private_key))
		result2 = matcher.accept(KeyPair(MID_MATCH.private_key))

		# Assert:
		self.assertTrue(matcher.is_complete)

		self.assertFalse(result1[1])
		self.assertEqual(START_MATCH.address, Network.TESTNET.public_key_to_address(result1[0].public_key))

		self.assertTrue(result2[1])
		self.assertEqual(MID_MATCH.address, Network.TESTNET.public_key_to_address(result2[0].public_key))

		self.assertEqual([
			'searching for \'AXEY3\' found TAXEYNYRRJVLIW4I36DPV2R2A63SJNOHRTZAG4Q (4 / 5)',
			'searching for \'AXEY3\' found TB4A7FJ262IGWXFPNDFTAXEY3POZ56SWQ34FG5Y (5 / 5)'
		], progress_lines)

	def test_can_accept_and_ignore_equal_match(self):
		# Arrange:
		progress_lines = []
		matcher = MultiAddressMatcher(Network.TESTNET, 100, progress_lines.append)
		matcher.add_search_pattern('AXEY7')

		# Act:
		result1 = matcher.accept(KeyPair(START_MATCH.private_key))
		result2 = matcher.accept(KeyPair(MID_MATCH.private_key))

		# Assert:
		self.assertFalse(matcher.is_complete)

		self.assertFalse(result1[1])
		self.assertEqual(START_MATCH.address, Network.TESTNET.public_key_to_address(result1[0].public_key))

		self.assertFalse(result2[1])
		self.assertEqual(None, result2[0])

		self.assertEqual([
			'searching for \'AXEY7\' found TAXEYNYRRJVLIW4I36DPV2R2A63SJNOHRTZAG4Q (4 / 5)'
		], progress_lines)

	def test_can_accept_and_ignore_worse_match(self):
		# Arrange:
		progress_lines = []
		matcher = MultiAddressMatcher(Network.TESTNET, 100, progress_lines.append)
		matcher.add_search_pattern('AXEY33')

		# Act:
		result1 = matcher.accept(KeyPair(MID_MATCH.private_key))
		result2 = matcher.accept(KeyPair(START_MATCH.private_key))

		# Assert:
		self.assertFalse(matcher.is_complete)

		self.assertFalse(result1[1])
		self.assertEqual(MID_MATCH.address, Network.TESTNET.public_key_to_address(result1[0].public_key))

		self.assertFalse(result2[1])
		self.assertEqual(None, result2[0])

		self.assertEqual([
			'searching for \'AXEY33\' found TB4A7FJ262IGWXFPNDFTAXEY3POZ56SWQ34FG5Y (5 / 6)'
		], progress_lines)

	# # endregion

	# region multi matching

	def _assert_multimatch(self, pattern1, pattern2):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, 100)
		matcher.add_search_pattern(pattern1)
		matcher.add_search_pattern(pattern2)

		# Act:
		result1 = matcher.accept(KeyPair(START_MATCH.private_key))
		result2 = matcher.accept(KeyPair(MID_MATCH.private_key))

		# Assert:
		self.assertTrue(matcher.is_complete)

		self.assertTrue(result1[1])
		self.assertEqual(START_MATCH.address, Network.TESTNET.public_key_to_address(result1[0].public_key))

		self.assertTrue(result2[1])
		self.assertEqual(MID_MATCH.address, Network.TESTNET.public_key_to_address(result2[0].public_key))

	def test_can_accept_multiple_different_patterns(self):
		self._assert_multimatch('AXEY', 'PND')

	def test_can_accept_multiple_same_patterns(self):
		self._assert_multimatch('AXEY', 'AXEY')

	def test_can_accept_at_most_one_match_per_private_key(self):
		# Arrange:
		matcher = MultiAddressMatcher(Network.TESTNET, 100)
		matcher.add_search_pattern('AXEY')
		matcher.add_search_pattern('AXEY')

		# Act:
		result = matcher.accept(KeyPair(START_MATCH.private_key))

		# Assert:
		self.assertFalse(matcher.is_complete)

		self.assertTrue(result[1])
		self.assertEqual(START_MATCH.address, Network.TESTNET.public_key_to_address(result[0].public_key))

	# endregion
