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
		self.nem_facade = NemFacade(str(network))

		log.info(f'Network: {network}')

	def _process_block(self, block_data):
		"""Process block data."""

		block = block_data['block']
		transactions = block_data['txes']

		timestamp = Block.convert_timestamp_to_datetime(self.nem_facade, block['timeStamp'])
		total_fees = sum(tx['tx']['fee'] for tx in transactions)

		return Block(
			block['height'],
			timestamp,
			total_fees,
			len(transactions),
			block_data['difficulty'],
			block_data['hash'],
			block['signer'],
			block['signature'],
		)

	def _store_block(self, cursor, block):
		"""Store block data."""

		save_block = self._process_block(block)
		self.database().insert_block(cursor, save_block)

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		nemesis_block = await self.client().get_block(1)

		# initialize cursor
		cursor = self.database().connection.cursor()

		self._store_block(cursor, nemesis_block)

		# commit changes
		self.database().connection.commit()

		log.info('added block from height 1')

	async def sync_blocks(self, db_height, chain_height):
		"""Sync network blocks."""

		# sync network blocks in database
		while chain_height > db_height:

			blocks = await self.client().get_blocks_after(db_height)

			# initialize cursor
			cursor = self.database().connection.cursor()

			for block in blocks['data']:
				self._store_block(cursor, block)

			# commit changes
			self.database().connection.commit()

			db_height = blocks['data'][-1]['block']['height']
			first_block_height = blocks['data'][0]['block']['height']

			log.info(f'added block from height {first_block_height} - {db_height}')
