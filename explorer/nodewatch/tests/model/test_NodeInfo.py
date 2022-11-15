import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey

from puller.model.Endpoint import Endpoint
from puller.model.NodeInfo import NodeInfo


class NodeInfoTest(unittest.TestCase):
	@staticmethod
	def _create_default_info(override=None):
		info = NodeInfo(
			123,
			Hash256('1B34F620153BD5B11AE3DC2C91317A0EF1145C6C28B9BCA2A55433097FE8737F'),
			PublicKey('FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2'),
			PublicKey('7663D638DDB64CEA9CD9FBFD9AD43B41D0CBA0141117E43243886BA6E8109912'),
			Endpoint('http', 'mysymbolnode.com', 3000),
			'xym rocks',
			'1.0.3.5',
			5)

		if override:
			setattr(info, override[0], override[1])

		return info

	def test_can_create_info(self):
		# Act:
		info = self._create_default_info()

		# Assert:
		self.assertEqual(123, info.network_identifier)
		self.assertEqual(Hash256('1B34F620153BD5B11AE3DC2C91317A0EF1145C6C28B9BCA2A55433097FE8737F'), info.network_generation_hash_seed)
		self.assertEqual(PublicKey('FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2'), info.main_public_key)
		self.assertEqual(PublicKey('7663D638DDB64CEA9CD9FBFD9AD43B41D0CBA0141117E43243886BA6E8109912'), info.node_public_key)
		self.assertEqual(Endpoint('http', 'mysymbolnode.com', 3000), info.endpoint)
		self.assertEqual('xym rocks', info.name)
		self.assertEqual('1.0.3.5', info.version)
		self.assertEqual(5, info.roles)

	def test_has_api_returns_false_when_api_role_is_not_set(self):
		for role in (1, 4, 5, 0xFD):
			# Arrange:
			info = self._create_default_info(('roles', role))

			# Act + Assert:
			self.assertFalse(info.has_api)

	def test_has_api_returns_true_when_api_role_is_set(self):
		for role in (1, 4, 5, 0xFD):
			# Arrange:
			info = self._create_default_info(('roles', role | NodeInfo.API_ROLE_FLAG))

			# Act + Assert:
			self.assertTrue(info.has_api)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		info = self._create_default_info()

		# Act:
		info_dict = info.to_dict()

		# Assert:
		self.assertEqual({
			'mainPublicKey': 'FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2',
			'nodePublicKey': '7663D638DDB64CEA9CD9FBFD9AD43B41D0CBA0141117E43243886BA6E8109912',
			'endpoint': 'http://mysymbolnode.com:3000',
			'name': 'xym rocks',
			'version': '1.0.3.5',
			'roles': 5
		}, info_dict)

	def test_can_convert_to_simple_dict_when_node_public_key_is_missing(self):
		# Arrange:
		info = self._create_default_info()
		info.node_public_key = None

		# Act:
		info_dict = info.to_dict()

		# Assert:
		self.assertEqual({
			'mainPublicKey': 'FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2',
			'nodePublicKey': None,
			'endpoint': 'http://mysymbolnode.com:3000',
			'name': 'xym rocks',
			'version': '1.0.3.5',
			'roles': 5
		}, info_dict)

	def test_eq_is_supported(self):
		# Arrange:
		info = self._create_default_info()
		other_public_key = PublicKey('C8B16FB70B85EBC341E2D71DFFDCE1E8020018B28637EB50E82057ACB039AFB1')
		other_hash = Hash256('C8B16FB70B85EBC341E2D71DFFDCE1E8020018B28637EB50E82057ACB039AFB1')

		# Act + Assert:
		self.assertEqual(info, self._create_default_info())
		self.assertNotEqual(info, None)
		self.assertNotEqual(info, 17)
		self.assertNotEqual(info, self._create_default_info(('network_identifier', 111)))
		self.assertNotEqual(info, self._create_default_info(('network_generation_hash_seed', other_hash)))
		self.assertNotEqual(info, self._create_default_info(('main_public_key', other_public_key)))
		self.assertNotEqual(info, self._create_default_info(('node_public_key', other_public_key)))
		self.assertNotEqual(info, self._create_default_info(('endpoint', Endpoint('https', 'mysymbolnode.com', 3001))))
		self.assertNotEqual(info, self._create_default_info(('name', 'xym xym')))
		self.assertNotEqual(info, self._create_default_info(('version', '1.0.3.4')))
		self.assertNotEqual(info, self._create_default_info(('roles', '4')))

	def test_repr_is_supported(self):
		# Arrange:
		info = self._create_default_info()

		# Act:
		info_repr = repr(info)
		info2 = eval(info_repr)  # pylint: disable=eval-used

		# Assert:
		self.assertEqual('\n'.join([
			'NodeInfo(',
			'\t123,',
			'\tHash256(\'1B34F620153BD5B11AE3DC2C91317A0EF1145C6C28B9BCA2A55433097FE8737F\'),',
			'\tPublicKey(\'FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2\'),',
			'\tPublicKey(\'7663D638DDB64CEA9CD9FBFD9AD43B41D0CBA0141117E43243886BA6E8109912\'),',
			'\tEndpoint(\'http\', \'mysymbolnode.com\', 3000),',
			'\t\'xym rocks\',',
			'\t\'1.0.3.5\',',
			'\t5)'
		]), info_repr)
		self.assertEqual(info, info2)

	def test_repr_is_supported_when_node_public_key_is_missing(self):
		# Arrange:
		info = self._create_default_info()
		info.node_public_key = None

		# Act:
		info_repr = repr(info)
		info2 = eval(info_repr)  # pylint: disable=eval-used

		# Assert:
		self.assertEqual('\n'.join([
			'NodeInfo(',
			'\t123,',
			'\tHash256(\'1B34F620153BD5B11AE3DC2C91317A0EF1145C6C28B9BCA2A55433097FE8737F\'),',
			'\tPublicKey(\'FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2\'),',
			'\tNone,',
			'\tEndpoint(\'http\', \'mysymbolnode.com\', 3000),',
			'\t\'xym rocks\',',
			'\t\'1.0.3.5\',',
			'\t5)'
		]), info_repr)
		self.assertEqual(info, info2)

	def test_repr_is_supported_when_network_generation_hash_seed_is_missing(self):
		# Arrange:
		info = self._create_default_info()
		info.network_generation_hash_seed = None

		# Act:
		info_repr = repr(info)
		info2 = eval(info_repr)  # pylint: disable=eval-used

		# Assert:
		self.assertEqual('\n'.join([
			'NodeInfo(',
			'\t123,',
			'\tNone,',
			'\tPublicKey(\'FDA457356DEB75DFBB7FC3B1B29E8A82ECE510CB4A471C1E0DCC9C889F2648C2\'),',
			'\tPublicKey(\'7663D638DDB64CEA9CD9FBFD9AD43B41D0CBA0141117E43243886BA6E8109912\'),',
			'\tEndpoint(\'http\', \'mysymbolnode.com\', 3000),',
			'\t\'xym rocks\',',
			'\t\'1.0.3.5\',',
			'\t5)'
		]), info_repr)
		self.assertEqual(info, info2)
