import os
import shutil
import tempfile
from pathlib import Path


class CertificateFactory:
	"""Uses openssl to generate SSL certificates and related files."""

	def __init__(self, openssl_executor, ca_key_path, ca_password=None):
		"""Creates a factory."""

		self.openssl_executor = openssl_executor
		self.ca_key_path = Path(ca_key_path)
		self.ca_password = ca_password

		self.temp_directory = None
		self.original_working_directory = None

	def __enter__(self):
		self.temp_directory = tempfile.TemporaryDirectory()
		self.original_working_directory = os.getcwd()
		os.chdir(self.temp_directory.name)
		return self

	def __exit__(self, *args):
		self.temp_directory.__exit__(*args)
		os.chdir(self.original_working_directory)

	def _add_ca_password(self, args):
		if self.ca_password:
			return args + ['-passin', self.ca_password]

		return args

	def extract_ca_public_key(self):
		"""Extracts a CA public key from a CA private key."""

		self.openssl_executor.dispatch(self._add_ca_password([
			'pkey',
			'-in', self.ca_key_path,
			'-out', 'ca.pubkey.pem',
			'-pubout'
		]))

	def generate_random_node_private_key(self):
		"""Generates a random NODE private key."""

		self._generate_random_private_key('node.key.pem')

	def generate_random_ca_private_key(self):
		"""Generates a random CA private key."""

		self._generate_random_private_key(self.ca_key_path.name)

	def _generate_random_private_key(self, name):
		self.openssl_executor.dispatch([
			'genpkey',
			'-out', name,
			'-outform', 'PEM',
			'-algorithm', 'ed25519'
		])

	def _prepare_ca_certificate(self, ca_cn):
		"""Prepare CA certificate environment."""

		if not ca_cn:
			raise RuntimeError('CA common name cannot be empty')

		# prepare CA config
		with open('ca.cnf', 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join([
				'[ca]',
				'default_ca = CA_default',
				'',
				'[CA_default]',
				'new_certs_dir = ./new_certs',
				'database = index.txt',
				'serial = serial.dat',
				f'private_key = {self.ca_key_path}',
				'certificate = ca.crt.pem',
				'policy = policy_catapult',
				'',
				'[policy_catapult]',
				'commonName = supplied',
				'',
				'[req]',
				'prompt = no',
				'distinguished_name = dn',
				'x509_extensions = x509_v3',
				'',
				'[dn]',
				f'CN = {ca_cn}'
				'',
				'[x509_v3]',
				'basicConstraints = critical,CA:TRUE',
				'subjectKeyIdentifier = hash',
				'authorityKeyIdentifier = keyid:always,issuer'
			]))

		# create new certs directory
		os.makedirs('new_certs')
		os.chmod('new_certs', 0o700)

		# create index.txt
		with open('index.txt', 'wt', encoding='utf8') as outfile:
			outfile.write('')

	def reuse_ca_certificate(self, ca_cn, ca_cert_path):
		"""Setup current CA certificate."""

		# prepare CA config
		self._prepare_ca_certificate(ca_cn)

		shutil.copy(ca_cert_path / 'ca.crt.pem', '.')

	def generate_ca_certificate(self, ca_cn, days=7300):
		"""Generates a CA certificate."""

		# prepare CA config
		self._prepare_ca_certificate(ca_cn)

		# actually generate CA certificate
		self.openssl_executor.dispatch(self._add_ca_password([
			'req',
			'-config', 'ca.cnf',
			'-keyform', 'PEM',
			'-key', self.ca_key_path,
			'-new', '-x509',
			'-days', str(days),
			'-out', 'ca.crt.pem'
		]))

	def generate_node_certificate(self, node_cn, days=375, start_date=None):
		"""Generates a node certificate."""

		if not node_cn:
			raise RuntimeError('Node common name cannot be empty')

		# prepare node config
		with open('node.cnf', 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join([
				'[req]',
				'prompt = no',
				'distinguished_name = dn',
				'x509_extensions = x509_v3',
				'',
				'[dn]',
				f'CN = {node_cn}',
				'',
				'[x509_v3]',
				'basicConstraints = CA:FALSE',
				'subjectKeyIdentifier = hash',
				'authorityKeyIdentifier = keyid,issuer'
			]))

		# prepare node certificate signing request
		self.openssl_executor.dispatch([
			'req',
			'-config', 'node.cnf',
			'-key', 'node.key.pem',
			'-new',
			'-out', 'node.csr.pem'
		])
		self.openssl_executor.dispatch([
			'rand',
			'-out', './serial.dat',
			'-hex',
			'19'
		])

		# actually generate node certificate
		self.openssl_executor.dispatch(self._add_ca_password([
			'ca',
			'-config', 'ca.cnf',
			'-days', str(days),
			'-notext',
			'-batch',
			'-in', 'node.csr.pem',
			'-out', 'node.crt.pem'
		] + ([] if not start_date else ['-startdate', start_date.strftime('%y%m%d%H%M%SZ')])))

	@staticmethod
	def create_node_certificate_chain():
		"""Creates a node certificate chain by concatenating CA and node certificates."""

		def _read_file(filepath):
			with open(filepath, 'rt', encoding='utf8') as infile:
				return infile.read()

		def _write_file(filepath, content):
			with open(filepath, 'wt', encoding='utf8') as outfile:
				return outfile.write(content)

		full_crt = _read_file('node.crt.pem')
		full_crt += _read_file('ca.crt.pem')
		_write_file('node.full.crt.pem', full_crt)

	@staticmethod
	def package(output_directory, package_filter=''):
		"""Creates a package of final files required for node deployment in the specifed output directory."""

		CertificateFactory._package(output_directory, package_filter, [
			'node.crt.pem', 'node.key.pem', 'ca.pubkey.pem', 'ca.crt.pem', 'node.full.crt.pem'
		])

	def export_ca(self):
		"""Exports the CA private key."""

		CertificateFactory._package(self.ca_key_path.parent, '', [self.ca_key_path.name])

	@staticmethod
	def _package(output_directory, package_filter, package_filenames):
		for filename in package_filenames:
			if not Path(filename).exists() or not filename.startswith(package_filter):
				continue

			destination_path = Path(output_directory) / filename
			shutil.move(filename, destination_path)
			destination_path.chmod(0o400)
