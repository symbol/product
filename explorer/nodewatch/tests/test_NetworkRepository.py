import unittest

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress

from nodewatch.NetworkRepository import NetworkRepository


class NetworkRepositoryTest(unittest.TestCase):
	# region load node descriptors

	def _assert_node_descriptor(self, descriptor, **kwargs):
		property_names = [
			'main_address', 'main_public_key', 'node_public_key',
			'endpoint', 'name', 'height', 'finalized_height', 'version', 'balance', 'roles', 'has_api'
		]
		for name in property_names:
			self.assertEqual(kwargs[name], getattr(descriptor, name))

	def test_can_load_nem_node_descriptors(self):
		# Arrange:
		repository = NetworkRepository('nem')

		# Act:
		repository.load_node_descriptors('tests/resources/nem_nodes.json')

		# Assert: descriptors are sorted by name (desc)
		self.assertTrue(repository.is_nem)
		self.assertEqual(4, len(repository.node_descriptors))
		self.assertEqual(3850057, repository.estimate_height())  # median
		self._assert_node_descriptor(
			repository.node_descriptors[0],
			main_address=NemAddress('NA32LQUMJBADX2XMKJ5QEIQBCF2ZIW5SZDXVGPOL'),
			main_public_key=PublicKey('EA786CE93FC760A4FD8E5E1F1336C0A2A915DE70EE28089331EC6658CE330282'),
			node_public_key=PublicKey('48695251C48CB8ADA29EAFCB30AF1B31CEA87A9F1438F04A9A767EA322233BCF'),
			endpoint='http://51.79.73.50:7890',
			name='August',
			height=3850057,
			finalized_height=0,
			version='0.6.100',
			balance=3355922.652725,
			roles=0xFF,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[1],
			main_address=NemAddress('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'),
			main_public_key=PublicKey('107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7'),
			node_public_key=PublicKey('733B57BFA43D66AF6F0CAEBFEE97284A768AFA880A4AD2CEF66F2CA5442ED206'),
			endpoint='http://jusan.nem.ninja:7890',
			name='[c=#e9c086]jusan[/c]',
			height=3850058,
			finalized_height=0,
			version='0.6.100',
			balance=20612359.516967,
			roles=0xFF,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[2],
			main_address=NemAddress('NDARKIXXPHDG5SEXSXVFIXXSNMOYJE4ZRI2CVWTL'),
			main_public_key=PublicKey('83F2791B70E06EA36520D044C6FD85B84CA9A31744C1173C640C36A2F3161846'),
			node_public_key=PublicKey('5A907614C7B81D64917B274B047C881BE5E1FCBD96B4F1D55FDFB5F370DDBDD4'),
			endpoint='http://45.76.22.139:7890',
			name='cobalt',
			height=0,
			finalized_height=0,
			version='0.6.99',
			balance=0,
			roles=0xFF,
			has_api=True)  # simulates missing extraData
		self._assert_node_descriptor(
			repository.node_descriptors[3],
			main_address=NemAddress('NDARKZ5F4YRWHPJN54NPT5YHEGQSKBT5SN2YZMIZ'),
			main_public_key=PublicKey('4AA8692447AC5ED16403C2C50BF7254D240D48A490D1D77B28B309680A36B431'),
			node_public_key=PublicKey('793AE97B0F9BC7B98A6DC4C397B1D104EA573D16B6B789DF8B46B13F2B5F076C'),
			endpoint='http://45.32.131.118:7890',
			name='silicon',
			height=0,
			finalized_height=0,
			version='0.6.100',
			balance=0,
			roles=0xFF,
			has_api=True)  # simulates incomplete extraData

	def test_can_load_symbol_node_descriptors(self):
		# Arrange:
		repository = NetworkRepository('symbol')

		# Act:
		repository.load_node_descriptors('tests/resources/symbol_nodes.json')

		# Assert: descriptors are sorted by name (desc)
		self.assertFalse(repository.is_nem)
		self.assertEqual(6, len(repository.node_descriptors))
		self.assertEqual(1486760, repository.estimate_height())  # median
		self._assert_node_descriptor(
			repository.node_descriptors[0],
			main_address=SymbolAddress('NDZOZPTDVCFFLDCNJL7NZGDQDNBB7TY3V6SZNGI'),
			main_public_key=PublicKey('A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21'),
			node_public_key=PublicKey('403D890915B68E290B3F519A602A13B17C58499A077D77DB7CCC6327761C84DC'),
			endpoint='',
			name='Allnodes250',
			height=1486762,
			finalized_height=1486740,
			version='1.0.3.4',
			balance=3155632.471994,
			roles=2,
			has_api=True)  # simulates missing host
		self._assert_node_descriptor(
			repository.node_descriptors[1],
			main_address=SymbolAddress('NCFJP3DM65U22JI5XZ2P2TBK5BV5MLKAR7334LQ'),
			main_public_key=PublicKey('A05329E4E5F068B323653F393CE0E3E6A1EB5056E122457354BA65158FFD33F4'),
			node_public_key=PublicKey('FBEAFCB15D2674ECB8DC1CD2C028C4AC0D463489069FDD415F30BB71EAE69864'),
			endpoint='http://02.symbol-node.net:3000',
			name='Apple',
			height=0,
			finalized_height=0,
			version='1.0.3.3',
			balance=0,
			roles=7,
			has_api=True)  # old version mapped to 'failure'
		self._assert_node_descriptor(
			repository.node_descriptors[2],
			main_address=SymbolAddress('NBPQMC4M2MMX2XOCOC3BCZ7N3ALUTRGLYPPQ56Q'),
			main_public_key=PublicKey('2784FBE82D8A46C4082519012970CBB42EC3EC83D5DB93963B71FD6C5DA3B072'),
			node_public_key=PublicKey('9CBE17EDFC8B333FE6BD3FF9B4D02914D55A9368F318D4CEF0AB4737BA5BB160'),
			endpoint='http://00fabf14.xym.stir-hosyu.com:3000',
			name='Shin-Kuma-Node',
			height=0,
			finalized_height=0,
			version='1.0.3.5',
			balance=0,
			roles=3,
			has_api=True)  # simulates incomplete extraData
		self._assert_node_descriptor(
			repository.node_descriptors[3],
			main_address=SymbolAddress('NCPPDLXGYBHNPQAXQ6RTNS3T46A7FNTXDFBD43Y'),
			main_public_key=PublicKey('7DFB0D690BFFA4A4979C7466C7B669AE8FBAFD419DAA10DE948604CD9BE65F0B'),
			node_public_key=PublicKey('D561824BD4E3053C39A8D5A4AB00583A4D99302C541F046D3A1E6FF023006D7C'),
			endpoint='http://symbol.shizuilab.com:3000',
			name='ibone74',
			height=1486760,
			finalized_height=1486740,
			version='1.0.3.5',
			balance=82375.554976,
			roles=3,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[4],
			main_address=SymbolAddress('NAEONICSHRZATW7XGIVIDPTNHUMQA7N7XQ4EUPQ'),
			main_public_key=PublicKey('B26D01FC006EAC09B740A3C8F12C1055AE24AFD3268F0364C92D51800FC07361'),
			node_public_key=None,
			endpoint='http://jaguar.catapult.ninja:7900',
			name='jaguar',
			height=1486761,
			finalized_height=1486740,
			version='1.0.3.5',
			balance=28083310.571743,
			roles=5,
			has_api=False)
		self._assert_node_descriptor(
			repository.node_descriptors[5],
			main_address=SymbolAddress('NDLLVJIUHAAV6F5PG5KYSSQXCZDCPXCY4WFA6TQ'),
			main_public_key=PublicKey('71F953D3C3D0B7E70E29EC2DE761DD7339BA815C094B3BEE0917AEBD924B37EB'),
			node_public_key=PublicKey('C71C7D5E6981DE5ED27908C6749207E49001A0B0F0DD404D07451636A64BEBEB'),
			endpoint='http://symbol.ooo:3000',
			name='symbol.ooo maxUnlockedAccounts:100',
			height=0,
			finalized_height=0,
			version='1.0.3.4',
			balance=0,
			roles=3,
			has_api=True)  # simulates missing extraData

	def test_can_format_node_descriptor_as_json(self):
		# Arrange:
		repository = NetworkRepository('symbol')
		repository.load_node_descriptors('tests/resources/symbol_nodes.json')

		# Act:
		json_object = repository.node_descriptors[4].to_json()

		# Assert:
		self.assertEqual({
			'mainPublicKey': 'B26D01FC006EAC09B740A3C8F12C1055AE24AFD3268F0364C92D51800FC07361',
			'nodePublicKey': None,
			'endpoint': 'http://jaguar.catapult.ninja:7900',
			'name': 'jaguar',
			'height': 1486761,
			'finalizedHeight': 1486740,
			'version': '1.0.3.5',
			'balance': 28083310.571743,
			'roles': 5,
		}, json_object)

	def test_can_format_node_descriptor_with_node_public_key_as_json(self):
		# Arrange:
		repository = NetworkRepository('symbol')
		repository.load_node_descriptors('tests/resources/symbol_nodes.json')

		# Act:
		json_object = repository.node_descriptors[3].to_json()

		# Assert:
		self.assertEqual({
			'mainPublicKey': '7DFB0D690BFFA4A4979C7466C7B669AE8FBAFD419DAA10DE948604CD9BE65F0B',
			'nodePublicKey': 'D561824BD4E3053C39A8D5A4AB00583A4D99302C541F046D3A1E6FF023006D7C',
			'endpoint': 'http://symbol.shizuilab.com:3000',
			'name': 'ibone74',
			'height': 1486760,
			'finalizedHeight': 1486740,
			'version': '1.0.3.5',
			'balance': 82375.554976,
			'roles': 3,
		}, json_object)

	# endregion

	# region load harvester descriptors

	def _assert_harvestor_descriptor(self, descriptor, **kwargs):
		property_names = ['signer_address', 'main_address', 'endpoint', 'name', 'height', 'finalized_height', 'version', 'balance']
		for name in property_names:
			self.assertEqual(kwargs[name], getattr(descriptor, name))

	def test_can_load_nem_harvester_descriptors(self):
		# Arrange:
		repository = NetworkRepository('nem')

		# Act:
		repository.load_harvester_descriptors('tests/resources/nem_harvesters.csv')

		# Assert: descriptors are sorted by balance (desc)
		self.assertTrue(repository.is_nem)
		self.assertEqual(4, len(repository.harvester_descriptors))
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[0],
			signer_address=NemAddress('NBU64S7UXWM32XE7US5COCIRHG6B5HT7PDWRKG2D'),
			main_address=NemAddress('NDWYJY4BS6NM4TLP7EVMVNMFBRYP5ORJPFPIQMN5'),
			endpoint='http://xem21.allnodes.me:7890',
			name='Allnodes21',
			height=3850030,
			finalized_height=0,
			version='0.6.100',
			balance=3679049.514376)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[1],
			signer_address=NemAddress('NCNDBFCX3KQ4PM6SNK2NLE6CWW5PZFNBE3YD4ZQI'),
			main_address=NemAddress('NCMFBRCEB6TMKFUIX4QGSZEAUNYBPRIMLTYKQKVF'),
			endpoint='http://149.56.47.0:7890',
			name='TIME',
			height=3850030,
			finalized_height=0,
			version='0.6.100',
			balance=3234896.107451)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[2],
			signer_address=NemAddress('NBAEFLTJG3UWXNXHOLUUPSZIDEHB6VJYLLVW5DFG'),
			main_address=NemAddress('NAVZOF3X2YEIFOWM7GZP2F7XKLVY6OVSRYFUOSZY'),
			endpoint='',
			name='',
			height=0,
			finalized_height=0,
			version='',
			balance=3087257.620626)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[3],
			signer_address=NemAddress('NA6N267O7JIRQY5WQTM4IFUFRMOUJDB5OAOQ777N'),
			main_address=NemAddress('NALICE7GX3PF3WAOWVLXFOQ4ZMOBP7GUMNB2RCYQ'),
			endpoint='http://104.238.161.61:7890',
			name='Hi, I am Alice7',
			height=3850030,
			finalized_height=0,
			version='0.6.100',
			balance=3002784.535609)

	def test_can_load_symbol_harvester_descriptors(self):
		# Arrange:
		repository = NetworkRepository('symbol')

		# Act:
		repository.load_harvester_descriptors('tests/resources/symbol_harvesters.csv')

		# Assert: descriptors are sorted by balance (desc)
		self.assertFalse(repository.is_nem)
		self.assertEqual(4, len(repository.harvester_descriptors))
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[0],
			signer_address=SymbolAddress('NAAPSQYOFCJSYLAS4YSK2FTPGSG3C3BEVZT67RY'),
			main_address=SymbolAddress('NAEONICSHRZATW7XGIVIDPTNHUMQA7N7XQ4EUPQ'),
			endpoint='http://jaguar.catapult.ninja:7900',
			name='jaguar',
			height=1486639,
			finalized_height=1486616,
			version='1.0.3.4',
			balance=28083310.571743)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[1],
			signer_address=SymbolAddress('NDUC4IVYBGTLG6S573CEN7IK6JOF6RZF3JIKOUQ'),
			main_address=SymbolAddress('NCV5FRMHB5P2EIDEWO63FSL4WEID72HWEJKOLHI'),
			endpoint='http://sn1.msus-symbol.com:3000',
			name='(Max50)SN1.MSUS',
			height=1486639,
			finalized_height=1486616,
			version='1.0.3.4',
			balance=5964230.349221)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[2],
			signer_address=SymbolAddress('NASRU37EPAAQY77S5XAB6LSZ7GDSHUYOUEWBWTI'),
			main_address=SymbolAddress('NDC4H2LCIXMROS4AWW2GR2EJMOKV7KUXTF6EX7A'),
			endpoint='',
			name='',
			height=0,
			finalized_height=0,
			version='',
			balance=3532170.443095)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[3],
			signer_address=SymbolAddress('NAMY6SCC5D32HG5R5QMJQF4FNBWIYF5AXOAQXUI'),
			main_address=SymbolAddress('NBWH7FHXWBLDFYMFGPEJH2PXX35FXSLXXP6FMTI'),
			endpoint='http://xym900.allnodes.me:3000',
			name='Allnodes900',
			height=1486640,
			finalized_height=1486616,
			version='1.0.3.4',
			balance=2381906.785304)

	# endregion

	# region load voter descriptors

	def _assert_voter_descriptor(self, descriptor, **kwargs):
		property_names = [
			'main_address', 'balance', 'is_voting', 'has_ever_voted', 'voting_end_epoch', 'current_epoch_votes',
			'endpoint', 'name', 'height', 'finalized_height', 'version'
		]
		for name in property_names:
			self.assertEqual(kwargs[name], getattr(descriptor, name))

	def test_can_load_symbol_voter_descriptors(self):
		# Arrange:
		repository = NetworkRepository('symbol')

		# Act:
		repository.load_voter_descriptors('tests/resources/symbol_richlist.csv')

		# Assert: descriptors are sorted by balance (desc)
		self.assertFalse(repository.is_nem)
		self.assertEqual(4, len(repository.voter_descriptors))
		self._assert_voter_descriptor(
			repository.voter_descriptors[0],
			main_address=SymbolAddress('NA6IYNDW5GWVO32D34GW6S5S45BQ6ELPEYMFRYQ'),
			balance=3803659.094721,
			is_voting=True,
			has_ever_voted=True,
			voting_end_epoch=1063,
			current_epoch_votes=['PRECOMMIT', 'PREVOTE'],
			endpoint='http://59026db.xym.gakky.net:3000',
			name='59026DB',
			height=1486130,
			finalized_height=1486112,
			version='1.0.3.4')
		self._assert_voter_descriptor(
			repository.voter_descriptors[1],
			main_address=SymbolAddress('NAIVRZYE72JWBGGTJOHV4JKZ5QJNAXJEJPROPAA'),
			balance=3711979.011862,
			is_voting=False,
			has_ever_voted=False,
			voting_end_epoch=0,
			current_epoch_votes=[''],
			endpoint='http://xym130.allnodes.me:3000',
			name='Allnodes130',
			height=1486130,
			finalized_height=1486112,
			version='1.0.3.4')
		self._assert_voter_descriptor(
			repository.voter_descriptors[2],
			main_address=SymbolAddress('NDU6BEMIOUF2OX7UMSCG6NUJUM2ZAY6JEGIPDOA'),
			balance=3702594.336991,
			is_voting=False,
			has_ever_voted=False,
			voting_end_epoch=0,
			current_epoch_votes=[''],
			endpoint='',
			name='',
			height=0,
			finalized_height=0,
			version='')
		self._assert_voter_descriptor(
			repository.voter_descriptors[3],
			main_address=SymbolAddress('NDBLOCQHSOLM5QVQT27UHNMVAJH2GHOVLGPGYKA'),
			balance=3669301.662695,
			is_voting=True,
			has_ever_voted=True,
			voting_end_epoch=1080,
			current_epoch_votes=['PREVOTE'],
			endpoint='http://xym34.allnodes.me:3000',
			name='Allnodes34',
			height=1486131,
			finalized_height=1486112,
			version='1.0.3.4')

	# endregion
