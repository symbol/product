import configparser

from symbolchain.facade.NemFacade import NemFacade
from zenlog import log

from client.NemClient import NemClient
from db.NemDatabase import NemDatabase
from model.Block import Block


class NemPullerFacade:
	"""Facade for pulling data from NEM network."""

	def __init__(self, node_url, config_file):
		"""Creates a facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['nem_db']

		self.nem_db = NemDatabase(db_config)
		self._client = NemClient(node_url)
		self.nem_facade = None

	def database(self):
		"""Gets database object."""

		return self.nem_db

	def client(self):
		"""Gets client object."""

		return self._client

	async def setup_facade(self):
		"""Setup the facade."""

		network = await self.client().node_network()
		self.nem_facade = NemFacade(network.name)

		log.info(f'Network: {network}')

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		block = await self.client().get_block(1)

		nemesis_block = {
			'difficulty': 0,
			'block': block,
			'txes': [{
				'tx': tx,
				'hash': f'#NemesisBlock# {index}'
			} for index, tx in enumerate(block['transactions'], start=1)
			],
			'hash': '#'
		}

		save_block = Block.from_nem_block_data(nemesis_block, self.nem_facade)
		self.database().insert_block(save_block)

		log.info(f'added block from height 1')

	async def sync_blocks(self, db_height, chain_height):
		"""Sync network blocks."""

		# sync network blocks in database
		while chain_height > db_height:

			blocks = await self.client().get_blocks_after(db_height)

			for block in blocks['data']:
				save_block = Block.from_nem_block_data(block, self.nem_facade)
				self.database().insert_block(save_block)

			db_height = blocks['data'][-1]['block']['height']
			first_block_height = blocks['data'][0]['block']['height']

			log.info(f'added block from height {first_block_height} - {db_height}')
