import configparser
from collections import namedtuple

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Network
from symbollightapi.connector.NemConnector import NemConnector
from zenlog import log

from puller.db.NemDatabase import NemDatabase

Block = namedtuple('Block', [
	'height',
	'timestamp',
	'total_fees',
	'total_transactions',
	'difficulty',
	'block_hash',
	'signer',
	'signature',
	'size'
])


def convert_timestamp_to_datetime(facade, timestamp):
	"""Formats a NEM network timestamp."""

	return facade.network.datetime_converter.to_datetime(timestamp).strftime('%Y-%m-%d %H:%M:%S')


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

	def _process_block(self, cursor, block_data):
		"""Process block data."""

		timestamp = convert_timestamp_to_datetime(self.nem_facade, block_data.timestamp)
		total_fees = sum(transaction.fee for transaction in block_data.transactions)

		block = Block(
			block_data.height,
			timestamp,
			total_fees,
			len(block_data.transactions),
			block_data.difficulty,
			block_data.block_hash,
			block_data.signer,
			block_data.signature,
			block_data.size
		)

		self.nem_db.insert_block(cursor, block)

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		nemesis_block = await self.nem_connector.get_block(1)

		# initialize cursor
		cursor = self.nem_db.connection.cursor()

		print('Syncing Nemesis block')

		self._process_block(cursor, nemesis_block)

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
				print(f'Syncing block height: {block}')
				self._process_block(cursor, block)

			# commit changes
			self.nem_db.connection.commit()

			db_height = blocks[-1].height
			first_block_height = blocks[0].height

			log.info(f'added block from height {first_block_height} - {db_height}')
