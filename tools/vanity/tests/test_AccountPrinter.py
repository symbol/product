import io
import unittest

from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Address, Network

from vanity.AccountPrinter import AccountPrinter

TEST_ADDRESS_1 = Address('TAXE5IVOJMGNZ5A42JN6QPTT2WX4XUXGDL4IBQY')
TEST_PUBLIC_KEY_1 = PublicKey('6C116FC69CA096940D2C511C66BAC1D5C20AE689F4B6F0C52D00A967494C5304')
TEST_PRIVATE_KEY_1 = PrivateKey('2D5CC79BE48A987DD9A9EBD79D137EAE7CA0F0711902AA613AAEFA15DCFA1C47')
TEST_MNEMONIC_1 = 'elder minor rain trim effort hire perfect laundry victory build charge egg fit abstract path female '
'tail brown omit kitten sea ready fly nurse'

TEST_ADDRESS_2 = Address('TCATKYMPRSXHLNXB74WPTRGV6FITP5KE6B5JPFQ')
TEST_PUBLIC_KEY_2 = PublicKey('95B6EC1E74F2F3FD17D0A834C36467242E6F970E0E86DCD2FA377527C453752F')
TEST_PRIVATE_KEY_2 = PrivateKey('46E5981027E8B0EBD7FF2CBE1CD44081801824A91DE66F3B0FFA38C9E9E3116D')
TEST_MNEMONIC_2 = 'seven physical behind item taste below describe weasel best drill flash club hotel autumn embark bounce '
'trumpet galaxy crunch actual attitude acoustic hockey stool'

TEST_ADDRESS_3 = Address('TDZZYEJLI6YQYZTWKILEB72G2PYZKKEOASJNS3Q')
TEST_PUBLIC_KEY_3 = PublicKey('997D8A8B408316C65FDCD3AD1E70B51866BBCFE08A6E4487E970B1305BCBF705')
TEST_PRIVATE_KEY_3 = PrivateKey('F7AD145E4C1E4603B8A52E778CF2465B79509A9898EDA23F20FD8ED7CD2AA21F')
TEST_MNEMONIC_3 = 'author train inject umbrella relief dwarf verify steel found umbrella frequent hat lamp tissue extend ahead '
'interest online matrix year later horse jacket rebuild'


class AccountPrinterTest(unittest.TestCase):
	def _test_can_print_with_format(self, format_mode, expected_lines, outfiles_count=1):
		# Arrange:
		printer = AccountPrinter(Network.TESTNET, format_mode)
		for _ in range(0, outfiles_count):
			printer.outfiles.append(io.StringIO())

		# Act:
		printer.write_header()
		printer.write_account(TEST_MNEMONIC_1, KeyPair(TEST_PRIVATE_KEY_1))
		printer.write_account(TEST_MNEMONIC_2, KeyPair(TEST_PRIVATE_KEY_2))
		printer.write_account(TEST_MNEMONIC_3, KeyPair(TEST_PRIVATE_KEY_3))

		# Assert:
		for outfile in printer.outfiles:
			outfile.seek(0)
			self.assertEqual('\n'.join(expected_lines), outfile.read())

	def test_can_print_in_pretty_format(self):
		self._test_can_print_with_format(AccountPrinter.FormatMode.PRETTY, [
			f'address (testnet): {TEST_ADDRESS_1}',
			f'       public key: {TEST_PUBLIC_KEY_1}',
			f'      private key: {TEST_PRIVATE_KEY_1}',
			f'         mnemonic: {TEST_MNEMONIC_1}',
			f'address (testnet): {TEST_ADDRESS_2}',
			f'       public key: {TEST_PUBLIC_KEY_2}',
			f'      private key: {TEST_PRIVATE_KEY_2}',
			f'         mnemonic: {TEST_MNEMONIC_2}',
			f'address (testnet): {TEST_ADDRESS_3}',
			f'       public key: {TEST_PUBLIC_KEY_3}',
			f'      private key: {TEST_PRIVATE_KEY_3}',
			f'         mnemonic: {TEST_MNEMONIC_3}',
			''
		])

	def test_can_print_in_csv_format(self):
		self._test_can_print_with_format(AccountPrinter.FormatMode.CSV, [
			'address,public key,private key,mnemonic',
			f'{TEST_ADDRESS_1},{TEST_PUBLIC_KEY_1},{TEST_PRIVATE_KEY_1},{TEST_MNEMONIC_1}',
			f'{TEST_ADDRESS_2},{TEST_PUBLIC_KEY_2},{TEST_PRIVATE_KEY_2},{TEST_MNEMONIC_2}',
			f'{TEST_ADDRESS_3},{TEST_PUBLIC_KEY_3},{TEST_PRIVATE_KEY_3},{TEST_MNEMONIC_3}',
			''
		])

	def test_can_print_to_multiple_streams(self):
		self._test_can_print_with_format(AccountPrinter.FormatMode.CSV, [
			'address,public key,private key,mnemonic',
			f'{TEST_ADDRESS_1},{TEST_PUBLIC_KEY_1},{TEST_PRIVATE_KEY_1},{TEST_MNEMONIC_1}',
			f'{TEST_ADDRESS_2},{TEST_PUBLIC_KEY_2},{TEST_PRIVATE_KEY_2},{TEST_MNEMONIC_2}',
			f'{TEST_ADDRESS_3},{TEST_PUBLIC_KEY_3},{TEST_PRIVATE_KEY_3},{TEST_MNEMONIC_3}',
			''
		], 3)
