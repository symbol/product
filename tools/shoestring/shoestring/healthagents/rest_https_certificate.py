import os
import re
import tempfile
from email.utils import parsedate_to_datetime
from pathlib import Path

from zenlog import log

from shoestring.internal.OpensslExecutor import OpensslExecutor

NAME = 'REST HTTPS certificate'


def should_run(node_config):
	return node_config.api_https


def _openssl_run_sclient_verify(servername, test_args):
	# some other commands are listed here https://www.cyberciti.biz/faq/terminate-close-openssl-s_client-command-connection-linux-unix/
	# note: adding '-quiet' flag seems to change behavior and s_client stops reacting to commands, so DON'T
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	lines = openssl_executor.dispatch([
		's_client',
		'-servername', servername,
		'-connect',
		'localhost:3001'
	] + test_args, command_input='Q', show_output=False)

	# verify the certificate is valid
	certificates = []
	collect_certificates = False
	for line in lines:
		line = line.strip()
		if line.startswith('verify error:'):
			return False, line

		# collect all certificates
		if line.startswith('-----BEGIN CERTIFICATE-----'):
			collect_certificates = True

		if collect_certificates:
			certificates.append(f'{line}\n')

		if line.startswith('-----END CERTIFICATE-----'):
			collect_certificates = False

	with tempfile.TemporaryDirectory() as temp_directory:
		temp_file = Path(temp_directory) / 'cert.txt'
		with open(temp_file, 'wt', encoding='utf-8') as cert_outfile:
			cert_outfile.writelines(certificates)

		lines = openssl_executor.dispatch([
			'storeutl',
			'-text',
			'-noout',
			'-certs',
			temp_file
		], show_output=False)

	date_patterns = []
	certificate_dates = []
	collect_dates = False
	collected_dates = []
	for line in lines:
		line = line.strip()
		if collect_dates and date_patterns:
			res = re.search(date_patterns[0], line)
			if res:
				certificate_dates.append(parsedate_to_datetime(res.group(1)))
				date_patterns.pop(0)
				if not date_patterns:
					# we have collected both dates for a certificate
					collected_dates.append((certificate_dates[0], certificate_dates[1]))
					certificate_dates.clear()
					collect_dates = False

				continue

		if 'Certificate:' == line:
			collect_dates = True
			date_patterns = [r'Not Before: (.*)', r'Not After : (.*)']

		if f'Total found: {len(collected_dates)}' == line:
			return True, collected_dates

	return False, 'could not parse s_client response'


async def validate(context):
	(host, _port) = context.peer_endpoint
	test_args = getattr(context, 'test_args', [])

	result, dates_or_error = _openssl_run_sclient_verify(host, test_args)

	if not result:
		log.warning(_('health-rest-https-certificate-invalid').format(error_message=dates_or_error))
	else:
		date_range = dates_or_error[-1]
		log.info(_('health-rest-https-certificate-valid').format(
			start_date=date_range[0].strftime('%y-%m-%d'),
			end_date=date_range[1].strftime('%y-%m-%d')))

	# note: I don't think we need to check dates, as verify should do that
