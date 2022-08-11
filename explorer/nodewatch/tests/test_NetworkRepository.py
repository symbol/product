import unittest

from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress

from nodewatch.NetworkRepository import NetworkRepository


class NetworkRepositoryTest(unittest.TestCase):
	# region load node descriptors

	def _assert_node_descriptor(self, descriptor, **kwargs):
		property_names = ['main_address', 'endpoint', 'name', 'height', 'finalized_height', 'version', 'balance', 'has_api']
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
			endpoint='http://51.79.73.50:7890',
			name='August',
			height=3850057,
			finalized_height=0,
			version='0.6.100',
			balance=3355922.652725,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[1],
			main_address=NemAddress('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'),
			endpoint='http://jusan.nem.ninja:7890',
			name='[c=#e9c086]jusan[/c]',
			height=3850058,
			finalized_height=0,
			version='0.6.100',
			balance=20612359.516967,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[2],
			main_address=NemAddress('NDARKIXXPHDG5SEXSXVFIXXSNMOYJE4ZRI2CVWTL'),
			endpoint='http://45.76.22.139:7890',
			name='cobalt',
			height=0,
			finalized_height=0,
			version='0.6.99',
			balance=0,
			has_api=True)  # simulates missing extraData
		self._assert_node_descriptor(
			repository.node_descriptors[3],
			main_address=NemAddress('NDARKZ5F4YRWHPJN54NPT5YHEGQSKBT5SN2YZMIZ'),
			endpoint='http://45.32.131.118:7890',
			name='silicon',
			height=0,
			finalized_height=0,
			version='0.6.100',
			balance=0,
			has_api=True)  # simulates incomplete extraData

	def test_can_load_symbol_node_descriptors(self):
		# Arrange:
		repository = NetworkRepository('symbol')

		# Act:
		repository.load_node_descriptors('tests/resources/symbol_nodes.json')

		# Assert: descriptors are sorted by name (desc)
		self.assertFalse(repository.is_nem)
		self.assertEqual(5, len(repository.node_descriptors))
		self.assertEqual(1486760, repository.estimate_height())  # median
		self._assert_node_descriptor(
			repository.node_descriptors[0],
			main_address=SymbolAddress('NDZOZPTDVCFFLDCNJL7NZGDQDNBB7TY3V6SZNGI'),
			endpoint='',
			name='Allnodes250',
			height=1486762,
			finalized_height=1486740,
			version='1.0.3.1',
			balance=3155632.471994,
			has_api=True)  # simulates missing host
		self._assert_node_descriptor(
			repository.node_descriptors[1],
			main_address=SymbolAddress('NBPQMC4M2MMX2XOCOC3BCZ7N3ALUTRGLYPPQ56Q'),
			endpoint='http://00fabf14.xym.stir-hosyu.com:3000',
			name='Shin-Kuma-Node',
			height=0,
			finalized_height=0,
			version='1.0.3.3',
			balance=0,
			has_api=True)  # simulates incomplete extraData
		self._assert_node_descriptor(
			repository.node_descriptors[2],
			main_address=SymbolAddress('NCPPDLXGYBHNPQAXQ6RTNS3T46A7FNTXDFBD43Y'),
			endpoint='http://symbol.shizuilab.com:3000',
			name='ibone74',
			height=1486760,
			finalized_height=1486740,
			version='1.0.3.3',
			balance=82375.554976,
			has_api=True)
		self._assert_node_descriptor(
			repository.node_descriptors[3],
			main_address=SymbolAddress('NAEONICSHRZATW7XGIVIDPTNHUMQA7N7XQ4EUPQ'),
			endpoint='http://jaguar.catapult.ninja:7900',
			name='jaguar',
			height=1486761,
			finalized_height=1486740,
			version='1.0.3.3',
			balance=28083310.571743,
			has_api=False)
		self._assert_node_descriptor(
			repository.node_descriptors[4],
			main_address=SymbolAddress('NDLLVJIUHAAV6F5PG5KYSSQXCZDCPXCY4WFA6TQ'),
			endpoint='http://symbol.ooo:3000',
			name='symbol.ooo maxUnlockedAccounts:100',
			height=0,
			finalized_height=0,
			version='1.0.3.1',
			balance=0,
			has_api=True)  # simulates missing extraData

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
			version='1.0.3.3',
			balance=28083310.571743)
		self._assert_harvestor_descriptor(
			repository.harvester_descriptors[1],
			signer_address=SymbolAddress('NDUC4IVYBGTLG6S573CEN7IK6JOF6RZF3JIKOUQ'),
			main_address=SymbolAddress('NCV5FRMHB5P2EIDEWO63FSL4WEID72HWEJKOLHI'),
			endpoint='http://sn1.msus-symbol.com:3000',
			name='(Max50)SN1.MSUS',
			height=1486639,
			finalized_height=1486616,
			version='1.0.3.3',
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
			version='1.0.3.3',
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
			version='1.0.3.3')
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
			version='1.0.3.3')
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
			version='1.0.3.3')

	# endregion
