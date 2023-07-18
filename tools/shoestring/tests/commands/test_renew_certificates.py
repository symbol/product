import os
import tempfile
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

from ..test.CertificateTestUtils import assert_certificate_properties, create_openssl_executor
from ..test.ConfigurationTestUtils import prepare_shoestring_configuration

# pylint: disable=invalid-name


# region node certificate renewal only

def _create_configuration(output_directory, ca_password, ca_common_name, node_common_name, filename):
	return prepare_shoestring_configuration(
		output_directory,
		NodeFeatures.PEER,
		ca_password=ca_password,
		ca_common_name=ca_common_name,
		node_common_name=node_common_name,
		filename=filename)


async def _assert_can_renew_node_certificate(ca_password=None):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath_1 = _create_configuration(output_directory, ca_password, 'ORIGINAL CA CN', 'ORIGINAL NODE CN', '1.shoestring.ini')
		config_filepath_2 = _create_configuration(output_directory, ca_password, 'ORIGINAL CA CN', 'NEW NODE CN', '2.shoestring.ini')
		preparer = Preparer(output_directory, parse_shoestring_configuration(config_filepath_1))

		# - generate CA private key pem file
		ca_private_key = PrivateKey.random()
		private_key_storage = PrivateKeyStorage(output_directory, ca_password)
		private_key_storage.save('ca.key', ca_private_key)

		# - generate initial set of certificates
		#   in order for node certificate to be verifiable, CA must have same issuer and subject
		ca_key_path = Path(output_directory) / 'ca.key.pem'
		preparer.directories.certificates.mkdir(parents=True)
		preparer.generate_certificates(ca_key_path, require_ca=True)

		# - save last modified times
		ca_certificate_path = preparer.directories.certificates / 'ca.crt.pem'
		ca_certificate_last_modified_time = ca_certificate_path.stat().st_mtime

		node_certificate_path = preparer.directories.certificates / 'node.crt.pem'
		node_certificate_last_modified_time = node_certificate_path.stat().st_mtime

		# Sanity:
		assert_certificate_properties(node_certificate_path, 'ORIGINAL CA CN', 'ORIGINAL NODE CN', 375)
		assert_certificate_properties(ca_certificate_path, 'ORIGINAL CA CN', 'ORIGINAL CA CN', 20 * 365)

		# Act:
		await main([
			'renew-certificates',
			'--config', str(config_filepath_2),
			'--directory', output_directory,
			'--ca-key-path', str(ca_key_path)
		])

		# Assert: node certificate is regenerated (subject changed)
		assert_certificate_properties(node_certificate_path, 'ORIGINAL CA CN', 'NEW NODE CN', 375)
		create_openssl_executor().dispatch(['verify', '-CAfile', ca_certificate_path, node_certificate_path])
		assert node_certificate_last_modified_time != node_certificate_path.stat().st_mtime

		# - ca certificate is not regenerated
		assert_certificate_properties(ca_certificate_path, 'ORIGINAL CA CN', 'ORIGINAL CA CN', 20 * 365)
		create_openssl_executor().dispatch(['verify', '-CAfile', ca_certificate_path, ca_certificate_path])
		assert ca_certificate_last_modified_time == ca_certificate_path.stat().st_mtime


async def test_can_renew_node_certificate():
	await _assert_can_renew_node_certificate()


async def test_can_renew_node_certificate_with_ca_password():
	await _assert_can_renew_node_certificate('abcd')

# endregion


# region CA and node certificates renewal

async def _assert_can_renew_ca_and_node_certificates(ca_password=None, use_relative_path=None):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath_1 = _create_configuration(output_directory, ca_password, 'ORIGINAL CA CN', 'ORIGINAL NODE CN', '1.shoestring.ini')
		config_filepath_2 = _create_configuration(output_directory, ca_password, 'NEW CA CN', 'NEW NODE CN', '2.shoestring.ini')
		preparer = Preparer(output_directory, parse_shoestring_configuration(config_filepath_1))

		with tempfile.TemporaryDirectory(dir=os.getcwd() if use_relative_path else None) as ca_directory:
			# - generate CA private key pem file
			ca_private_key = PrivateKey.random()
			private_key_storage = PrivateKeyStorage(ca_directory, ca_password)
			private_key_storage.save('ca.key', ca_private_key)

			# - generate initial set of certificates
			ca_key_path = (Path(ca_directory) if not use_relative_path else Path(ca_directory).relative_to(os.getcwd())) / 'ca.key.pem'
			preparer.directories.certificates.mkdir(parents=True)
			preparer.generate_certificates(Path(ca_key_path).absolute(), require_ca=True)

			# - save last modified times
			ca_certificate_path = preparer.directories.certificates / 'ca.crt.pem'
			ca_certificate_last_modified_time = ca_certificate_path.stat().st_mtime

			node_certificate_path = preparer.directories.certificates / 'node.crt.pem'
			node_certificate_last_modified_time = node_certificate_path.stat().st_mtime

			# Sanity:
			assert_certificate_properties(node_certificate_path, 'ORIGINAL CA CN', 'ORIGINAL NODE CN', 375)
			assert_certificate_properties(ca_certificate_path, 'ORIGINAL CA CN', 'ORIGINAL CA CN', 20 * 365)

			# Act:
			await main([
				'renew-certificates',
				'--config', str(config_filepath_2),
				'--directory', output_directory,
				'--ca-key-path', str(ca_key_path),
				'--renew-ca'
			])

			# Assert: node certificate is regenerated (subject changed)
			assert_certificate_properties(node_certificate_path, 'NEW CA CN', 'NEW NODE CN', 375)
			create_openssl_executor().dispatch(['verify', '-CAfile', ca_certificate_path, node_certificate_path])
			assert node_certificate_last_modified_time != node_certificate_path.stat().st_mtime

			# - ca certificate is regenerated (subject changed)
			assert_certificate_properties(ca_certificate_path, 'NEW CA CN', 'NEW CA CN', 20 * 365)
			create_openssl_executor().dispatch(['verify', '-CAfile', ca_certificate_path, ca_certificate_path])
			assert ca_certificate_last_modified_time != ca_certificate_path.stat().st_mtime


async def test_can_renew_ca_and_node_certificates():
	await _assert_can_renew_ca_and_node_certificates()


async def test_can_renew_ca_and_node_certificates_with_ca_password():
	await _assert_can_renew_ca_and_node_certificates('abcd')

# endregion


# region ca key path validation

async def test_can_renew_ca_and_node_certificates_with_relative_ca_key_path():
	await _assert_can_renew_ca_and_node_certificates(use_relative_path=True)


async def test_cannot_renew_ca_and_node_certificates_when_ca_key_path_does_not_exist():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath_1 = _create_configuration(output_directory, None, 'ORIGINAL CA CN', 'ORIGINAL NODE CN', '1.shoestring.ini')
		config_filepath_2 = _create_configuration(output_directory, None, 'NEW CA CN', 'NEW NODE CN', '2.shoestring.ini')
		preparer = Preparer(output_directory, parse_shoestring_configuration(config_filepath_1))

		# - generate CA private key pem file
		ca_private_key = PrivateKey.random()
		private_key_storage = PrivateKeyStorage(output_directory)
		private_key_storage.save('ca.key', ca_private_key)

		# - generate initial set of certificates
		ca_key_path = Path(output_directory) / 'ca.key.pem'
		preparer.directories.certificates.mkdir(parents=True)
		preparer.generate_certificates(Path(ca_key_path).absolute(), require_ca=True)

		# Act + Assert:
		with pytest.raises(RuntimeError):
			await main([
				'renew-certificates',
				'--config', str(config_filepath_2),
				'--directory', output_directory,
				'--ca-key-path', f'{ca_key_path}.non-existent',
				'--renew-ca'
			])

# endregion
