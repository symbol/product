import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from zenlog import log

from shoestring.internal.OpensslExecutor import OpensslExecutor

NAME = 'peer certificate'
CERT_RENEW_DAYS_WARNING = 30


def should_run(_):
	return True


def _openssl_get_certificate_date(openssl_executor, certificate_path, date_type):
	line = openssl_executor.dispatch([
		'x509',
		'-in', str(certificate_path),
		f'-{date_type}date',
		'-noout'
	], show_output=False)[0].strip()

	rfc_822_date = line.split('=')[1]
	return parsedate_to_datetime(rfc_822_date)


def _process_end_certificate_date(current_datetime, name, certificate_datetime):
	days_remaining = (certificate_datetime - current_datetime).days
	if certificate_datetime < current_datetime:
		log.error(_('health-peer-certificate-expired').format(name=name, days_expired=-days_remaining))
	elif (certificate_datetime - current_datetime).days < CERT_RENEW_DAYS_WARNING:
		log.warning(_('health-peer-certificate-near-expiry').format(name=name, days_remaining=days_remaining))
	else:
		log.info(_('health-peer-certificate-not-near-expiry').format(name=name, days_remaining=days_remaining))


def _process_start_certificate_date(current_datetime, name, certificate_datetime):
	if current_datetime < certificate_datetime:
		log.error(_('health-peer-certificate-future-start').format(name=name, start_date=certificate_datetime.strftime('%y-%m-%d')))


def _load_binary_file_data(filename):
	with open(filename, 'rb') as infile:
		return infile.read()


def _check_certificate_lifetime(openssl_executor, crt_path, name):
	current_date = datetime.now(timezone.utc)

	end_date = _openssl_get_certificate_date(openssl_executor, crt_path, 'end')
	_process_end_certificate_date(current_date, name, end_date)

	start_date = _openssl_get_certificate_date(openssl_executor, crt_path, 'start')
	_process_start_certificate_date(current_date, name, start_date)


def _verify_certificate(openssl_executor, ca_crt_path, crt_path, name):
	try:
		openssl_executor.dispatch(['verify', '-CAfile', ca_crt_path, crt_path])
	except RuntimeError:
		log.error(_('health-peer-certificate-not-verifiable').format(name=name))


async def validate(context):
	package_files = [path.name for path in sorted(context.directories.certificates.iterdir())]
	expected_package_files = ['ca.crt.pem', 'ca.pubkey.pem', 'node.crt.pem', 'node.full.crt.pem', 'node.key.pem']

	if expected_package_files != package_files:
		missing_files = ', '.join(sorted(set(expected_package_files) - set(package_files)))
		log.error(_('health-peer-certificate-missing-files').format(missing_files=missing_files))
		return

	# verify that node.full == node.crt + ca.crt
	node_full_crt_data = _load_binary_file_data(context.directories.certificates / 'node.full.crt.pem')
	node_crt_path = context.directories.certificates / 'node.crt.pem'
	node_crt_data = _load_binary_file_data(node_crt_path)
	ca_crt_path = context.directories.certificates / 'ca.crt.pem'
	ca_crt_data = _load_binary_file_data(ca_crt_path)

	if node_full_crt_data != node_crt_data + ca_crt_data:
		log.error(_('health-peer-certificate-corrupt-full-certificate'))
		return

	# check certificate lifetime
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	_check_certificate_lifetime(openssl_executor, ca_crt_path, 'ca')
	_check_certificate_lifetime(openssl_executor, node_crt_path, 'node')

	# verify certificates
	_verify_certificate(openssl_executor, ca_crt_path, ca_crt_path, 'ca')
	_verify_certificate(openssl_executor, ca_crt_path, node_crt_path, 'node')
