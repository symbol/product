from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import SymbolAccountRecord, SymbolMultisigRecord
from rest.facade.SymbolRestFacade import SymbolRestFacade


def create_account_record(
	address=bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57'),
	node_public_key=None,
	vrf_public_key=None):
	"""Creates a minimal valid account record for facade wiring tests."""

	return SymbolAccountRecord(
		address,
		None,
		'main',
		None,
		0,
		bytes.fromhex('11' * 32),
		node_public_key,
		vrf_public_key,
		[],
		[],
		2,
		[],
		())


class RecordingAccountDatabase:
	def __init__(self):
		self.account_query = None
		self.multisig_query = None
		self.account_record = create_account_record()
		self.multisig_record = SymbolMultisigRecord(
			2, 1, [], [bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')])

	def get_account(self, address, public_key):
		self.account_query = (address, public_key)
		return self.account_record

	def get_multisig(self, address):
		self.multisig_query = address
		return self.multisig_record


class SymbolRestFacadeAccountTest(TestCase):
	def test_get_account_passes_search_and_network_to_view(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.TESTNET)

		# Act:
		result = facade.get_account(None, bytes.fromhex('01' * 32))

		# Assert:
		self.assertEqual((None, bytes.fromhex('01' * 32)), database.account_query)
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['address'])
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['supplementalKeys']['linked'])

	def test_get_account_formats_mainnet_account_and_supplemental_keys(self):
		# Arrange:
		database = RecordingAccountDatabase()
		database.account_record = create_account_record(
			bytes.fromhex('68A991D03CBA797AED52A061E6BF2F7F238D8A85CFCED03D'),
			bytes.fromhex('22' * 32),
			bytes.fromhex('00' * 32))
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.MAINNET)

		# Act:
		result = facade.get_account(None, bytes.fromhex('01' * 32))

		# Assert:
		self.assertEqual('NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI', result['address'])
		self.assertEqual((None, bytes.fromhex('01' * 32)), database.account_query)
		self.assertEqual({
			'linked': 'ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y',
			'node': 'NAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY4X3FNY',
			'vrf': 'NAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMUL5QKI'
		}, result['supplementalKeys'])

	def test_get_multisig_preserves_cosignatory_only_threshold_null(self):
		# Arrange:
		database = RecordingAccountDatabase()
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.TESTNET)

		# Act:
		result = facade.get_multisig(bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57'))

		# Assert:
		self.assertEqual(None, result['minApproval'])
		self.assertEqual(None, result['minRemoval'])

	def test_get_multisig_converts_mainnet_related_addresses(self):
		# Arrange:
		database = RecordingAccountDatabase()
		database.multisig_record = SymbolMultisigRecord(
			1, 1, [bytes.fromhex('687585978CADF2186CE5D92576FC849FBF6ECE7B36CF9635')],
			[bytes.fromhex('68F6CB4276B16A349A1C3CD50C3752775AD5D3F2F7299640')])
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6),
			Network.MAINNET)

		# Act:
		result = facade.get_multisig(bytes.fromhex('68FD35818960C7B18B72F49A5598FA9F712A354DB3BF4C77'))

		# Assert:
		self.assertEqual({
			'minApproval': 1,
			'minRemoval': 1,
			'cosignatoryAddresses': ['NB2YLF4MVXZBQ3HF3ESXN7EET67W5TT3G3HZMNI'],
			'multisigAddresses': ['ND3MWQTWWFVDJGQ4HTKQYN2SO5NNLU7S64UZMQA']
		}, result)
