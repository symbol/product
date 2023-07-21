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


def _openssl_run_sclient_verify(hostname, test_args):
	# some other commands are listed here https://www.cyberciti.biz/faq/terminate-close-openssl-s_client-command-connection-linux-unix/
	# note: adding '-quiet' flag seems to change behavior and s_client stops reacting to commands, so DON'T
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	lines = openssl_executor.dispatch([
		's_client',
		'-servername', hostname,
		'-connect',
		'localhost:3001'
	] + test_args, command_input='Q', show_output=False)

	# verify the certificate is valid
	for line in lines:
		line = line.strip()
		if line.startswith('verify error:'):
			# normalize error message
			if '1.1.1' in openssl_executor.version():
				line = line.replace('self signed', 'self-signed')
			return False, line

	with tempfile.TemporaryDirectory() as temp_directory:
		temp_file = Path(temp_directory) / 'cert.txt'
		with open(temp_file, 'wt', encoding='utf-8') as cert_outfile:
			cert_outfile.writelines(lines)

		lines = openssl_executor.dispatch([
			'x509',
			'-inform', 'pem',
			'-noout',
			'-text',
			'-in', temp_file
		], command_input='Q', show_output=False)

	date_patterns = [r'Not Before: (.*)', r'Not After : (.*)']
	collect_dates = False
	collected_dates = []
	for line in lines:
		line = line.strip()
		if collect_dates and date_patterns:
			res = re.search(date_patterns[0], line)
			if res:
				collected_dates.append(parsedate_to_datetime(res.group(1)))
				date_patterns.pop(0)

		if line == 'Certificate:':
			collect_dates = True

	return (True, collected_dates) if 2 == len(collected_dates) else (False, 'could not parse s_client response')


async def validate(context):
	hostname = context.hostname
	test_args = getattr(context, 'test_args', [])

	result, dates_or_error = _openssl_run_sclient_verify(hostname, test_args)

	if not result:
		log.warning(_('health-rest-https-certificate-invalid').format(error_message=dates_or_error))
	else:
		date_range = dates_or_error
		log.info(_('health-rest-https-certificate-valid').format(
			start_date=date_range[0].strftime('%y-%m-%d'),
			end_date=date_range[1].strftime('%y-%m-%d')))

	# note: I don't think we need to check dates, as verify should do that
