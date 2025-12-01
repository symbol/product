import configparser
import threading
from collections import namedtuple
from queue import Queue

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Network
from symbollightapi.connector.NemConnector import NemConnector
from zenlog import log

from puller.db.NemDatabase import NemDatabase

BlockRecord = namedtuple('BlockRecord', [
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
DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


class NemPuller:
	"""Facade for pulling data from NEM network."""

	def __init__(self, node_url, config_file, network_type='mainnet'):
		"""Creates a facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['nem_db']

		network = Network.MAINNET if network_type == 'mainnet' else Network.TESTNET

		self.nem_db = NemDatabase(DatabaseConfig(**db_config))
		self.nem_connector = NemConnector(node_url, network)
		self.nem_facade = NemFacade(str(network))

	def _convert_timestamp_to_datetime(self, timestamp):
		"""Formats a NEM network timestamp to UTC."""

		return self.nem_facade.network.datetime_converter.to_datetime(timestamp).strftime('%Y-%m-%d %H:%M:%S+00:00')

	def _commit_blocks(self, message=None):
		"""Commit blocks to database with error handling."""

		self.nem_db.connection.commit()
		if message:
			log.info(message)

	def _process_block(self, cursor, block_data):
		"""Process block data."""

		timestamp = self._convert_timestamp_to_datetime(block_data.timestamp)
		total_fees = sum(transaction.fee for transaction in block_data.transactions)

		block = BlockRecord(
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
		"""Sync and write Nemesis block to database."""

		nemesis_block = await self.nem_connector.get_block(1)

		cursor = self.nem_db.connection.cursor()

		self._process_block(cursor, nemesis_block)

		self._commit_blocks('Committed Nemesis block')

	def _db_writer(self, block_queue, batch_size=50):
		"""
		Consumer blocks from queue and write to database in batches.
		"""

		cursor = self.nem_db.connection.cursor()
		processed = 0

		log.info('DB writer thread started')

		while True:
			# retrieve block from queue
			block = block_queue.get()

			# Check for sentinel value (None) to stop processing
			if block is None:
				log.info('Received stop signal, ending DB writer thread')
				break

			# Process and insert block
			self._process_block(cursor, block)
			processed += 1

			# Batch commits
			if processed % batch_size == 0:
				self._commit_blocks(f'Committed {processed} blocks')

			block_queue.task_done()

		# Final commit for remaining blocks
		if processed % batch_size != 0:
			self._commit_blocks()

		log.info(f'Database thread: {processed} blocks inserted')

	async def sync_blocks(self, db_height, chain_height, queue_size=200, batch_size=50):
		"""sync blocks from NEM network."""

		block_queue = Queue(maxsize=queue_size)

		# Start database thread FIRST
		db_thread = threading.Thread(
			target=self._db_writer,
			args=(block_queue, batch_size),
			daemon=True
		)
		db_thread.start()

		log.info('Starting block sync...')

		try:
			while chain_height > db_height:
				blocks = await self.nem_connector.get_blocks_after(db_height)

				for block in blocks:
					block_queue.put(block)

				last_block_height = blocks[-1].height
				first_block_height = blocks[0].height

				db_height = last_block_height

				log.info(f'fetch block from height {first_block_height} - {last_block_height}')

			# Wait for all blocks to be processed
			block_queue.join()

			# Send stop signal to db_writer thread
			block_queue.put(None)
			db_thread.join(timeout=10)

			log.info('Block sync complete')

		except Exception as error:
			log.error(f'Sync error: {error}')
			block_queue.put(None)
			raise
