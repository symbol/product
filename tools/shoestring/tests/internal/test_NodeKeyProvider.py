import os
import tempfile
import unittest
from pathlib import Path

from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.NodeKeyProvider import NodeKeyProvider
from shoestring.internal.OpensslExecutor import OpensslExecutor


class NodeKeyProviderTest(unittest.TestCase):
	# region utils

	@staticmethod
	def _create_executor():
		return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))

	# endregion

	# region NodeKeyProvider

	def test_can_generates_node_key(self):
		# Arrange:
		node_key_provider = NodeKeyProvider(None)

		# Act:
		with tempfile.TemporaryDirectory() as package_directory:
			with CertificateFactory(self._create_executor(), Path(package_directory) / 'xyz.key.pem') as factory:
				node_key_provider.create_key_file(factory)
				factory.package(package_directory)

			node_key_filepath = Path(package_directory) / 'node.key.pem'

			# Assert:
			self.assertEqual(False, node_key_provider.is_imported)
			self.assertEqual(True, node_key_filepath.exists())

	def test_can_reuse_existing_node_key(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			with CertificateFactory(self._create_executor(), Path(package_directory) / 'xyz.key.pem') as factory:
				factory.generate_random_node_private_key()
				factory.package(package_directory)

			# Sanity:
			node_key_filepath = Path(package_directory) / 'node.key.pem'
			assert node_key_filepath.exists()

			# Act
			with tempfile.TemporaryDirectory() as renew_directory:
				def _load_binary_file_data(filename):
					with open(filename, 'rb') as infile:
						return infile.read()

				node_key_provider = NodeKeyProvider(node_key_filepath)
				with CertificateFactory(self._create_executor(), Path(renew_directory) / 'xyz.key.pem') as factory:
					node_key_provider.create_key_file(factory)
					factory.package(renew_directory)

				# Assert:
				renew_node_key_filepath = Path(renew_directory) / 'node.key.pem'
				self.assertEqual(True, node_key_provider.is_imported)
				self.assertEqual(True, renew_node_key_filepath.exists())

				node_key_data = _load_binary_file_data(node_key_filepath)
				renew_node_key_data = _load_binary_file_data(renew_node_key_filepath)
				assert node_key_data == renew_node_key_data

	def test_cannot_generates_node_key_with_no_certificate_factory(self):
		with self.assertRaises(RuntimeError):
			node_key_provider = NodeKeyProvider(None)
			node_key_provider.create_key_file(None)

	def test_cannot_reuse_node_key_with_invalid_path(self):
		with self.assertRaises(FileNotFoundError):
			node_key_provider = NodeKeyProvider('/path/to/node/key/pem')
			node_key_provider.create_key_file(None)

	# endregion
