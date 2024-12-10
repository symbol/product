import os
import tempfile
import unittest
from pathlib import Path

from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.NodeKeyUtils import write_node_key_file
from shoestring.internal.OpensslExecutor import OpensslExecutor


class NodeKeyUtilsTest(unittest.TestCase):
	# region utils

	@staticmethod
	def _create_executor():
		return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))

	# endregion

	# region tests

	def test_can_generate_random_node_key(self):
		# Act:
		with tempfile.TemporaryDirectory() as package_directory:
			with CertificateFactory(self._create_executor(), Path(package_directory) / 'xyz.key.pem') as factory:
				write_node_key_file(factory)
				factory.package(package_directory)

			node_key_filepath = Path(package_directory) / 'node.key.pem'

			# Assert:
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

				with CertificateFactory(self._create_executor(), Path(renew_directory) / 'xyz.key.pem') as factory:
					write_node_key_file(factory, node_key_filepath)
					factory.package(renew_directory)

				# Assert:
				renew_node_key_filepath = Path(renew_directory) / 'node.key.pem'
				self.assertEqual(True, renew_node_key_filepath.exists())

				node_key_data = _load_binary_file_data(node_key_filepath)
				renew_node_key_data = _load_binary_file_data(renew_node_key_filepath)
				assert node_key_data == renew_node_key_data

	def test_cannot_generate_node_key_with_no_certificate_factory(self):
		# Act + Assert:
		with self.assertRaises(RuntimeError):
			write_node_key_file(None)

	def test_cannot_reuse_node_key_with_invalid_path(self):
		# Act + Assert:
		with self.assertRaises(FileNotFoundError):
			write_node_key_file(None, '/path/to/node/key/pem')

	# endregion
