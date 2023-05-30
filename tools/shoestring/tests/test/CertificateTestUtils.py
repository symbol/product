import datetime
import os
import re

from shoestring.internal.OpensslExecutor import OpensslExecutor


def create_openssl_executor():
	return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))


def assert_certificate_properties(certificate_path, expected_issuer, expected_subject, expected_days):
	x509_output = ''.join(create_openssl_executor().dispatch(['x509', '-noout', '-text', '-in', certificate_path], False))

	assert expected_issuer == re.search(r'Issuer: CN = (.*)\n', x509_output).group(1)
	assert expected_subject == re.search(r'Subject: CN = (.*)\n', x509_output).group(1)

	time_format = '%b %d %H:%M:%S %Y %Z'
	cert_start_time = datetime.datetime.strptime(re.search(r'Not Before: (.*)\n', x509_output).group(1), time_format)
	cert_end_time = datetime.datetime.strptime(re.search(r'Not After : (.*)\n', x509_output).group(1), time_format)
	assert expected_days == (cert_end_time - cert_start_time).days
