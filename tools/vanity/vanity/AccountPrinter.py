from enum import Enum


class AccountPrinter:
	"""Formats and prints account information."""

	class FormatMode(Enum):
		"""Format modes."""

		PRETTY = 1
		CSV = 2

	def __init__(self, network, mode):
		"""Creates a printer."""

		self.network = network
		self.is_csv = self.FormatMode.CSV == mode
		self.outfiles = []

	def write_header(self):
		"""Writes a header."""

		if self.is_csv:
			self._write('address,public key,private key,mnemonic')

	def write_account(self, mnemonic, key_pair):
		"""Writes an account with a mnemonic."""

		address = self.network.public_key_to_address(key_pair.public_key)

		if self.is_csv:
			self._write(f'{address},{key_pair.public_key},{key_pair.private_key},{mnemonic}')
		else:
			self._write(f'address ({self.network.name}): {address}')
			self._write(f'       public key: {key_pair.public_key}')
			self._write(f'      private key: {key_pair.private_key}')
			self._write(f'         mnemonic: {mnemonic}')

		for outfile in self.outfiles:
			outfile.flush()

	def _write(self, line):
		for outfile in self.outfiles:
			outfile.write(f'{line}\n')
