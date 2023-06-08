import os
import shutil
import tempfile
from collections import namedtuple
from datetime import datetime, timedelta, timezone
from pathlib import Path

from shoestring.healthagents.peer_certificate import should_run, validate
from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import NodeConfiguration, ShoestringConfiguration

from ..test.LogTestUtils import LogLevel, assert_max_log_level, assert_message_is_logged

# pylint: disable=invalid-name


# region should_run

def test_should_run_for_all_roles():
	# Act + Assert:
	for features in (NodeFeatures.PEER, NodeFeatures.API, NodeFeatures.HARVESTER, NodeFeatures.VOTER):
		assert should_run(NodeConfiguration(features, *([None] * 6))), str(features)

# endregion


# region validate - utils

def _create_executor():
	return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))


def _create_configuration():
	node_config = NodeConfiguration(NodeFeatures.PEER, None, None, None, None, 'CA CN', 'NODE CN')
	return ShoestringConfiguration('testnet', None, None, None, node_config)


async def _dispatch_validate(directories):
	# Arrange:
	HealthAgentContext = namedtuple('HealthAgentContext', ['directories'])
	context = HealthAgentContext(directories)

	# Act:
	await validate(context)

# endregion


# region validate - missing and/or corrupted file(s)

async def _assert_validate_fails_when_any_certificate_file_is_missing(caplog, filename):
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:  # pylint: disable=duplicate-code
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - delete single file
			(preparer.directories.certificates / filename).unlink()

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged(f'there are missing files in certificate directory: {filename}', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_ca_certificate_is_missing(caplog):
	await _assert_validate_fails_when_any_certificate_file_is_missing(caplog, 'ca.crt.pem')


async def test_validate_fails_when_ca_public_key_is_missing(caplog):
	await _assert_validate_fails_when_any_certificate_file_is_missing(caplog, 'ca.pubkey.pem')


async def test_validate_fails_when_node_certificate_is_missing(caplog):
	await _assert_validate_fails_when_any_certificate_file_is_missing(caplog, 'node.crt.pem')


async def test_validate_fails_when_node_full_certificate_is_missing(caplog):
	await _assert_validate_fails_when_any_certificate_file_is_missing(caplog, 'node.full.crt.pem')


async def test_validate_fails_when_node_private_key_is_missing(caplog):
	await _assert_validate_fails_when_any_certificate_file_is_missing(caplog, 'node.key.pem')


async def test_validate_fails_when_multiple_files_are_missing(caplog):
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - delete three files
			for filename in ('ca.crt.pem', 'node.crt.pem', 'node.key.pem'):
				(preparer.directories.certificates / filename).unlink()

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged('there are missing files in certificate directory: ca.crt.pem, node.crt.pem, node.key.pem', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_node_full_certificate_is_corrupt(caplog):
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - corrupt node.full.crt.pem
			(preparer.directories.certificates / 'node.full.crt.pem').chmod(0o600)
			with open(preparer.directories.certificates / 'node.full.crt.pem', 'ab') as outfile:
				outfile.write(bytes([0x00]))

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged('node.full.crt.pem does not look like a product of node and CA certificates', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)

# endregion


# region validate - CA certificate date checks

def _generate_certificates(openssl_executor, ca_key_path, certificates_directory, package_filter='', ca_args=None, node_args=None):
	# pylint: disable=too-many-arguments
	with CertificateFactory(openssl_executor, ca_key_path) as factory:
		factory.generate_random_ca_private_key()
		factory.export_ca()

		factory.extract_ca_public_key()
		factory.generate_ca_certificate('CA CN', **(ca_args or {}))
		factory.generate_random_node_private_key()
		factory.generate_node_certificate('NODE CN', **(node_args or {}))
		factory.create_node_certificate_chain()

		factory.package(certificates_directory, package_filter)


def _regenerate_node_full_certificate(certificates_directory):
	def _read_file(filepath):
		with open(filepath, 'rt', encoding='utf8') as infile:
			return infile.read()

	def _write_file(filepath, content):
		with open(filepath, 'wt', encoding='utf8') as outfile:
			return outfile.write(content)

	full_crt = _read_file(certificates_directory / 'node.crt.pem')
	full_crt += _read_file(certificates_directory / 'ca.crt.pem')
	(certificates_directory / 'node.full.crt.pem').chmod(0o600)
	_write_file(certificates_directory / 'node.full.crt.pem', full_crt)


async def _validate_ca_certificate_lifetime_check(days):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()

			ca_key_path = Path(output_directory) / 'ca.key.pem'
			openssl_executor = _create_executor()
			_generate_certificates(openssl_executor, ca_key_path, preparer.directories.certificates, ca_args={'days': days})

			# Act:
			await _dispatch_validate(preparer.directories)


async def test_validate_warns_when_ca_certificate_is_near_expiry(caplog):
	# Act:
	await _validate_ca_certificate_lifetime_check(30)

	# Assert:
	assert_message_is_logged('ca certificate near expiry (29 day(s))', caplog)
	assert_max_log_level(LogLevel.WARNING, caplog)


def _copy_certificates_from_test_resources(directory, certificates_directory):
	(certificates_directory / 'ca.crt.pem').chmod(0o600)
	(certificates_directory / 'node.crt.pem').chmod(0o600)
	shutil.copy(f'./tests/resources/{directory}/ca.crt.pem', certificates_directory / 'ca.crt.pem')
	shutil.copy(f'./tests/resources/{directory}/node.crt.pem', certificates_directory / 'node.crt.pem')
	_regenerate_node_full_certificate(certificates_directory)


async def test_validate_fails_when_ca_certificate_starts_in_future(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - replace certs with fake ones
			_copy_certificates_from_test_resources('future_peer_certs', preparer.directories.certificates)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			future_time = datetime(2053, 6, 12, 14, 59, 59, 0, timezone.utc)
			assert_message_is_logged(f'ca certificate start date is in future ({future_time.strftime("%y%m%d")})', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_ca_certificate_is_expired(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - replace certs with fake ones
			_copy_certificates_from_test_resources('expired_ca_cert', preparer.directories.certificates)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert: ca expired, but verification of both fails
			expiration_delta = datetime(2023, 6, 11, 14, 59, 59, 0, timezone.utc) - datetime.now(timezone.utc)
			assert_message_is_logged(f'ca certificate expired ({-expiration_delta.days} day(s) ago)', caplog)
			assert_message_is_logged('could not verify ca certificate', caplog)
			assert_message_is_logged('could not verify node certificate', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_ca_certificate_is_not_verifiable(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()

			ca_key_path = Path(output_directory) / 'ca.key.pem'
			openssl_executor = _create_executor()
			_generate_certificates(openssl_executor, ca_key_path, preparer.directories.certificates)

			# - swap CA and node certificates
			shutil.move(preparer.directories.certificates / 'node.crt.pem', preparer.directories.certificates / 'temp.crt.pem')
			shutil.move(preparer.directories.certificates / 'ca.crt.pem', preparer.directories.certificates / 'node.crt.pem')
			shutil.move(preparer.directories.certificates / 'temp.crt.pem', preparer.directories.certificates / 'ca.crt.pem')
			_regenerate_node_full_certificate(preparer.directories.certificates)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged('could not verify ca certificate', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)

# endregion


# region validate - node certificate date checks

async def _validate_node_certificate_lifetime_check(days, start_date):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()

			ca_key_path = Path(output_directory) / 'ca.key.pem'
			openssl_executor = _create_executor()
			_generate_certificates(openssl_executor, ca_key_path, preparer.directories.certificates, node_args={
				'days': days,
				'start_date': start_date
			})

			# Act:
			await _dispatch_validate(preparer.directories)


async def test_validate_warns_when_node_certificate_is_near_expiry(caplog):
	# Act:
	await _validate_node_certificate_lifetime_check(30, datetime.now(timezone.utc))

	# Assert:
	assert_message_is_logged('node certificate near expiry (29 day(s))', caplog)
	assert_max_log_level(LogLevel.WARNING, caplog)


async def test_validate_fails_when_node_certificate_starts_in_future(caplog):
	# Act:
	start_date = datetime.now() + timedelta(days=1)
	await _validate_node_certificate_lifetime_check(300, start_date)

	# Assert:
	assert_message_is_logged(f'node certificate start date is in future ({start_date.strftime("%y%m%d")})', caplog)
	assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_node_certificate_is_expired(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# - replace certs with fake ones
			_copy_certificates_from_test_resources('expired_node_cert', preparer.directories.certificates)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert: node certificate can't be verified, ca certificate can be verified
			expiration_delta = datetime(2022, 6, 22, 14, 59, 59, 0, timezone.utc) - datetime.now(timezone.utc)
			assert_message_is_logged(f'node certificate expired ({-expiration_delta.days} day(s) ago)', caplog)
			assert_message_is_logged('could not verify node certificate', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_node_certificate_is_not_verifiable(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()

			ca_key_path = Path(output_directory) / 'ca.key.pem'
			openssl_executor = _create_executor()
			_generate_certificates(openssl_executor, ca_key_path, preparer.directories.certificates)

			# - regenerate node certificates with different CA
			_generate_certificates(openssl_executor, ca_key_path, preparer.directories.certificates, 'node')
			_regenerate_node_full_certificate(preparer.directories.certificates)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged('could not verify node certificate', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)

# endregion


# region validate - success

async def test_validate_passes_when_all_certificates_are_far_from_expiry(caplog):
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# Act:
			await _dispatch_validate(preparer.directories)

			# Assert:
			assert_message_is_logged('node certificate not near expiry (374 day(s))', caplog)
			assert_message_is_logged('ca certificate not near expiry (7299 day(s))', caplog)
			assert_max_log_level(LogLevel.INFO, caplog)

# endregion
