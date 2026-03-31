import unittest

from rest.model.Namespace import NamespaceView


class NamespaceTest(unittest.TestCase):
	@staticmethod
	def _create_default_namespace_view(override=None):
		namespace_view = NamespaceView(
			root_namespace='namespace',
			owner='107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7',
			registered_height=100,
			registered_timestamp='2015-03-29 20:39:21',
			expiration_height=525700,
			sub_namespaces=['namespace.sub_1', 'namespace.sub_2']
		)

		if override:
			setattr(namespace_view, override[0], override[1])

		return namespace_view

	def test_can_create_namespace_view(self):
		# Act:
		namespace_view = self._create_default_namespace_view()

		# Assert:
		self.assertEqual('namespace', namespace_view.root_namespace)
		self.assertEqual('107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7', namespace_view.owner)
		self.assertEqual(100, namespace_view.registered_height)
		self.assertEqual('2015-03-29 20:39:21', namespace_view.registered_timestamp)
		self.assertEqual(525700, namespace_view.expiration_height)
		self.assertEqual(['namespace.sub_1', 'namespace.sub_2'], namespace_view.sub_namespaces)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		namespace_view = self._create_default_namespace_view()

		# Act:
		namespace_view_dict = namespace_view.to_dict()

		# Assert:
		self.assertEqual({
			'rootNamespace': 'namespace',
			'owner': '107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7',
			'registeredHeight': 100,
			'registeredTimestamp': '2015-03-29 20:39:21',
			'expirationHeight': 525700,
			'subNamespaces': ['namespace.sub_1', 'namespace.sub_2']
		}, namespace_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		namespace_view = self._create_default_namespace_view()

		# Assert:
		self.assertEqual(namespace_view, self._create_default_namespace_view())
		self.assertNotEqual(namespace_view, None)
		self.assertNotEqual(namespace_view, 'namespace_view')
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('root_namespace', 'different')))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('owner', 'PUBLIC_KEY')))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('registered_height', 101)))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('registered_timestamp', 'timestamp')))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('expiration_height', 525701)))
		self.assertNotEqual(namespace_view, self._create_default_namespace_view(('sub_namespaces', ['namespace.sub_3'])))
