import datetime
import os
import re
import tempfile
import unittest
from pathlib import Path

from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.OpensslExecutor import OpensslExecutor


class CertificateFactoryTest(unittest.TestCase):
	# region common utils

	@staticmethod
	def _create_executor():
		return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))

	@staticmethod
	def _create_ca_private_key(certificate_directory):
		ca_private_key_path = Path(certificate_directory) / 'xyz.key.pem'
		CertificateFactoryTest._create_executor().dispatch([
			'genpkey',
			'-out', ca_private_key_path,
			'-outform', 'PEM',
			'-algorithm', 'ed25519'
		])
		return ca_private_key_path

	# endregion

	# region basic

	def test_working_directory_is_automatically_changed_and_restored(self):
		# Arrange:
		original_working_directory = os.getcwd()

		# Act:
		with CertificateFactory(self._create_executor(), Path()) as factory:
			# Assert: working directory was changed
			self.assertIsNotNone(factory)
			self.assertNotEqual(original_working_directory, os.getcwd())

		# -  working directory was restored
		self.assertEqual(original_working_directory, os.getcwd())

	# endregion

	# region key files

	@staticmethod
	def _assert_pem_contains_private_key(filepath):
		CertificateFactoryTest._create_executor().dispatch([
			'pkey',
			'-in', filepath,
			'-noout',
			'-text'
		])

	def _assert_pem_contains_only_public_key(self, filepath):
		# does not contain private key
		with self.assertRaises(RuntimeError):
			self._assert_pem_contains_private_key(filepath)

		# contains public key
		self._create_executor().dispatch([
			'pkey',
			'-in', filepath,
			'-pubin',
			'-noout',
			'-text'
		])

	def test_can_generate_random_ca_private_key(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			with CertificateFactory(self._create_executor(), Path(package_directory) / 'xyz.key.pem') as factory:
				# Act:
				factory.generate_random_ca_private_key()
				factory.export_ca()

				# Assert:
				package_files = list(path.name for path in Path(package_directory).iterdir())
				self.assertEqual(['xyz.key.pem'], package_files)

				# - can load and parse CA private key
				self._assert_pem_contains_private_key(Path(package_directory) / 'xyz.key.pem')

	def test_can_generate_random_node_private_key(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			with CertificateFactory(self._create_executor(), Path()) as factory:
				# Act:
				factory.generate_random_node_private_key()
				factory.package(package_directory)

				# Assert:
				package_files = list(path.name for path in Path(package_directory).iterdir())
				self.assertEqual(['node.key.pem'], package_files)

				# - can load and parse node private key
				self._assert_pem_contains_private_key(Path(package_directory) / 'node.key.pem')

	def test_can_generate_ca_public_key(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			# - create a CA private key
			with tempfile.TemporaryDirectory() as certificate_directory:
				ca_private_key_path = self._create_ca_private_key(certificate_directory)

				with CertificateFactory(self._create_executor(), ca_private_key_path) as factory:
					# Act:
					factory.extract_ca_public_key()
					factory.package(package_directory)

					# Assert:
					package_files = list(path.name for path in Path(package_directory).iterdir())
					self.assertEqual(['ca.pubkey.pem'], package_files)

					# - can load and parse CA public key (but not private key)
					self._assert_pem_contains_only_public_key(Path(package_directory) / 'ca.pubkey.pem')

	# endregion

	# region certificates

	def _assert_certificate_issuer_and_subject(self, x509_output, expected_issuer, expected_subject):
		self.assertEqual(expected_issuer, re.search(r'Issuer: CN = (.*)\n', x509_output).group(1))
		self.assertEqual(expected_subject, re.search(r'Subject: CN = (.*)\n', x509_output).group(1))

	def _assert_certificate_duration(self, x509_output, test_start_time, expected_days):
		time_format = '%b %d %H:%M:%S %Y %Z'
		cert_start_time = datetime.datetime.strptime(re.search(r'Not Before: (.*)\n', x509_output).group(1), time_format)
		cert_end_time = datetime.datetime.strptime(re.search(r'Not After : (.*)\n', x509_output).group(1), time_format)

		self.assertLessEqual(test_start_time, cert_start_time)
		self.assertLessEqual(cert_start_time, datetime.datetime.utcnow())
		self.assertEqual(expected_days, (cert_end_time - cert_start_time).days)

	def test_can_generate_ca_certificate(self):
		# Arrange:
		# - certificate has second resolution, so clear microseconds for assert below to work
		test_start_time = datetime.datetime.utcnow().replace(microsecond=0)
		with tempfile.TemporaryDirectory() as package_directory:
			ca_certificate_path = Path(package_directory) / 'ca.crt.pem'

			# - create a CA private key
			with tempfile.TemporaryDirectory() as certificate_directory:
				ca_private_key_path = self._create_ca_private_key(certificate_directory)

				with CertificateFactory(self._create_executor(), ca_private_key_path) as factory:
					# Act:
					factory.generate_ca_certificate('my CA common name')
					factory.package(package_directory)

					# Assert:
					package_files = list(path.name for path in Path(package_directory).iterdir())
					self.assertEqual(['ca.crt.pem'], package_files)

					x509_output = ''.join(self._create_executor().dispatch([
						'x509', '-noout', '-text', '-in', ca_certificate_path
					], False))

					# - check issuer and subject common names are correct
					self._assert_certificate_issuer_and_subject(x509_output, 'my CA common name', 'my CA common name')

					# - check start and expiry times
					self._assert_certificate_duration(x509_output, test_start_time, 20 * 365)

					# - verify certificate is properly self signed
					self._create_executor().dispatch(['verify', '-CAfile', ca_certificate_path, ca_certificate_path])

	def _assert_can_generate_node_certificate(self, should_generate_certificate_chain):
		# Arrange:
		# - certificate has second resolution, so clear microseconds for assert below to work
		test_start_time = datetime.datetime.utcnow().replace(microsecond=0)
		with tempfile.TemporaryDirectory() as package_directory:
			ca_certificate_path = Path(package_directory) / 'ca.crt.pem'
			node_certificate_path = Path(package_directory) / ('node.full.crt.pem' if should_generate_certificate_chain else 'node.crt.pem')

			# - create a CA private key
			with tempfile.TemporaryDirectory() as certificate_directory:
				ca_private_key_path = self._create_ca_private_key(certificate_directory)

				with CertificateFactory(self._create_executor(), ca_private_key_path) as factory:
					# create node private key and CA certificate
					factory.generate_random_node_private_key()
					factory.generate_ca_certificate('my CA common name')

					# Act:
					factory.generate_node_certificate('my NODE common name')
					if should_generate_certificate_chain:
						factory.create_node_certificate_chain()

					factory.package(package_directory)

					# Assert:
					package_files = sorted(list(path.name for path in Path(package_directory).iterdir()))
					expected_package_files = ['ca.crt.pem', 'node.crt.pem', 'node.key.pem']
					if should_generate_certificate_chain:
						expected_package_files += ['node.full.crt.pem']

					expected_package_files.sort()
					self.assertEqual(expected_package_files, package_files)

					x509_output = ''.join(self._create_executor().dispatch([
						'x509', '-noout', '-text', '-in', node_certificate_path
					], False))

					# - check issuer and subject common names are correct
					self._assert_certificate_issuer_and_subject(x509_output, 'my CA common name', 'my NODE common name')

					# - check start and expiry times
					self._assert_certificate_duration(x509_output, test_start_time, 375)

					# - verify certificate is properly signed by CA
					self._create_executor().dispatch(['verify', '-CAfile', ca_certificate_path, node_certificate_path])

	def test_can_generate_node_certificate(self):
		self._assert_can_generate_node_certificate(False)

	def test_can_generate_node_certificate_chain(self):
		self._assert_can_generate_node_certificate(True)

	# endregion

	# region packaging

	def _assert_all_files_read_only(self, directory, expected_files):
		# check files
		actual_files = sorted(list(path.name for path in Path(directory).iterdir()))
		self.assertEqual(expected_files, actual_files)

		# - check permissions
		for path in Path(directory).iterdir():
			self.assertEqual(0o400, path.stat().st_mode & 0o777)

	def _assert_can_create_package_containing_all_files(self, package_args, expected_package_files):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			# - create a CA private key
			with tempfile.TemporaryDirectory() as certificate_directory:
				ca_private_key_path = self._create_ca_private_key(certificate_directory)

				with CertificateFactory(self._create_executor(), ca_private_key_path) as factory:
					# - generate all package files
					factory.extract_ca_public_key()
					factory.generate_random_node_private_key()
					factory.generate_ca_certificate('my CA common name')
					factory.generate_node_certificate('my NODE common name')
					factory.create_node_certificate_chain()

					# Sanity:
					self._assert_all_files_read_only(package_directory, [])

					# Act:
					factory.package(package_directory, *package_args)

					# Assert:
					self._assert_all_files_read_only(package_directory, expected_package_files)

	def test_can_package_all_files(self):
		self._assert_can_create_package_containing_all_files([], [
			'ca.crt.pem', 'ca.pubkey.pem', 'node.crt.pem', 'node.full.crt.pem', 'node.key.pem'
		])

	def test_can_package_ca_files(self):
		self._assert_can_create_package_containing_all_files(['ca'], ['ca.crt.pem', 'ca.pubkey.pem'])

	def test_can_package_node_files(self):
		self._assert_can_create_package_containing_all_files(['node'], ['node.crt.pem', 'node.full.crt.pem', 'node.key.pem'])

	def test_can_export_ca(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as package_directory:
			with tempfile.TemporaryDirectory() as certificate_directory:
				with CertificateFactory(self._create_executor(), Path(certificate_directory) / 'xyz.key.pem') as factory:
					# - generate a few files
					factory.generate_random_ca_private_key()
					factory.generate_random_node_private_key()

					# Sanity:
					self._assert_all_files_read_only(certificate_directory, [])
					self._assert_all_files_read_only(package_directory, [])

					# Act:
					factory.export_ca()
					factory.package(package_directory)

					# Assert: files are not mixed and packaged appropriately
					self._assert_all_files_read_only(certificate_directory, ['xyz.key.pem'])
					self._assert_all_files_read_only(package_directory, ['node.key.pem'])

	# endregion
