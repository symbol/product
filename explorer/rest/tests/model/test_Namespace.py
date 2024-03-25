import unittest

from symbolchain.nem.Network import Address

from rest.model.Namespace import NamespaceView


class NamespaceTest(unittest.TestCase):
	@staticmethod
	def _create_default_namespace_view(override=None):
		namespace_view = NamespaceView(
			'dragon',
			Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
			10,
			'2015-03-29 20:34:19',
			525610,
			['dragon.tank', 'dragon.tower.uk'],
			[
				{
					'namespaceName': 'dragon',
					'mosaicName': 'dragonfly',
					'totalSupply': 100,
					'divisibility': 0,
					'registeredHeight': 300,
					'registeredTimestamp': '2015-03-29 20:34:19'
				}
			]
		)

		if override:
			setattr(namespace_view, override[0], override[1])

		return namespace_view

	def test_can_create_namespace_view(self):
		# Act:
		namespace_view = self._create_default_namespace_view()

		# Assert:
		self.assertEqual('dragon', namespace_view.root_namespace)
		self.assertEqual(Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'), namespace_view.owner)
		self.assertEqual(10, namespace_view.registered_height)
		self.assertEqual('2015-03-29 20:34:19', namespace_view.registered_timestamp)
		self.assertEqual(525610, namespace_view.expiration_height)
		self.assertEqual(['dragon.tank', 'dragon.tower.uk'], namespace_view.sub_namespaces)
		self.assertEqual(
			[{
				'namespaceName': 'dragon',
				'mosaicName': 'dragonfly',
				'totalSupply': 100,
				'divisibility': 0,
				'registeredHeight': 300,
				'registeredTimestamp': '2015-03-29 20:34:19'
			}],
			namespace_view.mosaics
		)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		namespace_view = self._create_default_namespace_view()

		# Act:
		namespace_view_dict = namespace_view.to_dict()

		# Assert:
		self.assertEqual({
			'rootNamespace': 'dragon',
			'owner': 'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3',
			'registeredHeight': 10,
			'registeredTimestamp': '2015-03-29 20:34:19',
			'expirationHeight': 525610,
			'subNamespaces': ['dragon.tank', 'dragon.tower.uk'],
			'mosaics': [{
				'namespaceName': 'dragon',
				'mosaicName': 'dragonfly',
				'totalSupply': 100,
				'divisibility': 0,
				'registeredHeight': 300,
				'registeredTimestamp': '2015-03-29 20:34:19'
			}]
		}, namespace_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		namespace_view = self._create_default_namespace_view()

		# Assert:
		self.assertEqual(namespace_view, self._create_default_namespace_view())
		self.assertNotEqual(namespace_view, None)
		self.assertNotEqual(namespace_view, 'namespace_view')
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('root_namespace', 'namespace')))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('owner', Address('TALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'))))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('registered_height', 11)))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('registered_timestamp', '2015-03-29 20:34:20')))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('expiration_height', 525611)))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('sub_namespaces', ['dragon.tank'])))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('mosaics', [])))
