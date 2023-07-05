import configparser

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Network
from symbollightapi.connector.NemConnector import NemConnector
from zenlog import log

from db.NemDatabase import NemDatabase
from model.Block import Block


class NemPuller:
	"""Facade for pulling data from NEM network."""

	def __init__(self, node_url, config_file, network_type='mainnet'):
		"""Creates a facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['nem_db']

		network = Network.MAINNET if network_type == 'mainnet' else Network.TESTNET

		self.nem_db = NemDatabase(db_config)
		self.nem_connector = NemConnector(node_url, network)
		self.nem_facade = NemFacade(str(network))

	def _process_block(self, block_data):
		"""Process block data."""

		timestamp = Block.convert_timestamp_to_datetime(self.nem_facade, block_data.timestamp)
		total_fees = sum(tx['tx']['fee'] for tx in block_data.transactions)

		return Block(
			block_data.height,
			timestamp,
			total_fees,
			len(block_data.transactions),
			block_data.difficulty,
			block_data.block_hash,
			block_data.signer,
			block_data.signature,
		)

	def _store_block(self, cursor, block):
		"""Store block data."""

		save_block = self._process_block(block)
		self.nem_db.insert_block(cursor, save_block)

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		nemesis_block = await self.nem_connector.get_block(1)

		# initialize cursor
		cursor = self.nem_db.connection.cursor()

		self._store_block(cursor, nemesis_block)

		# commit changes
		self.nem_db.connection.commit()

		log.info('added block from height 1')

	async def sync_blocks(self, db_height, chain_height):
		"""Sync network blocks."""

		# sync network blocks in database
		while chain_height > db_height:

			blocks = await self.nem_connector.get_blocks_after(db_height)

			# initialize cursor
			cursor = self.nem_db.connection.cursor()

			for block in blocks:
				self._store_block(cursor, block)

			# commit changes
			self.nem_db.connection.commit()

			db_height = blocks[-1].height
			first_block_height = blocks[0].height

			log.info(f'added block from height {first_block_height} - {db_height}')
