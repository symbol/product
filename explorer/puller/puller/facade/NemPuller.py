import asyncio
import configparser
import threading
from collections import namedtuple
from queue import Queue

from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Address, Network
from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

from puller.db.NemDatabase import NemDatabase

BlockRecord = namedtuple('BlockRecord', [
	'height',
	'timestamp',
	'total_fee',
	'total_transactions',
	'difficulty',
	'block_hash',
	'beneficiary',
	'signer',
	'signature',
	'size'
])
AccountRecord = namedtuple('AccountRecord', [
	'address',
	'public_key',
	'remote_address',
	'importance',
	'balance',
	'vested_balance',
	'mosaics',
	'harvested_blocks',
	'status',
	'remote_status',
	'min_cosignatories',
	'cosignatory_of',
	'cosignatories'
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

	async def _retry_operation(self, operation, description, retries=3, delay=2):  # pylint: disable=no-self-use
		"""Retries an async operation with exponential backoff."""

		for attempt in range(1, retries + 1):
			try:
				return await operation()
			except NodeException as error:
				if attempt < retries:
					wait_time = delay * (2 ** (attempt - 1))  # Exponential backoff: 2s, 4s, 8s
					log.warning(f'Error {description} (attempt {attempt}/{retries}): {error}. Retrying in {wait_time}s...')
					await asyncio.sleep(wait_time)
				else:
					log.error(f'Failed {description} after {retries} attempts: {error}')
					raise

	async def _retry_get_blocks_after(self, height, retries=3, delay=2):
		"""Retries fetching blocks after a given height with exponential backoff."""

		return await self._retry_operation(
			lambda: self.nem_connector.get_blocks_after(height),
			f'fetching blocks after height {height}',
			retries,
			delay
		)

	async def _retry_get_account_info(self, address, forwarded=False, retries=3, delay=2):
		"""Retries fetching account info with exponential backoff."""

		return await self._retry_operation(
			lambda: self.nem_connector.account_info(address, forwarded),
			f'fetching account {address[:16]}...',
			retries,
			delay
		)

	async def _retry_get_account_mosaics(self, address, retries=3, delay=2):
		"""Retries fetching account mosaics with exponential backoff."""

		return await self._retry_operation(
			lambda: self.nem_connector.account_mosaics(address),
			f'fetching mosaics for account {address[:16]}...',
			retries,
			delay
		)

	def _convert_timestamp_to_datetime(self, timestamp):
		"""Formats a NEM network timestamp to UTC."""

		return self.nem_facade.network.datetime_converter.to_datetime(timestamp).strftime('%Y-%m-%d %H:%M:%S+00:00')

	def _convert_public_key_to_address(self, public_key):
		"""Convert public key to address."""

		return self.nem_facade.network.public_key_to_address(PublicKey(public_key))

	def _extract_addresses_from_block(self, block):
		"""Extract address and public key from block and transactions."""

		addresses = set()

		public_key_fields = ['sender', 'remote_account', 'creator']
		address_fields = ['recipient', 'rental_fee_sink', 'creation_fee_sink']

		def _extract_from_transaction(transaction):
			# Extract from public key fields
			for field in public_key_fields:
				value = getattr(transaction, field, None)
				if value:
					addresses.add(str(self._convert_public_key_to_address(value)))

			# Extract from address fields
			for field in address_fields:
				value = getattr(transaction, field, None)
				if value:
					addresses.add(str(Address(value)))

			# Handle levy recipient
			levy = getattr(transaction, 'levy', None)
			if levy:
				addresses.add(str(Address(levy.recipient)))

			# Handle multisig signatures
			if hasattr(transaction, 'signatures'):
				for signature in transaction.signatures:
					other_account = getattr(signature, 'other_account', None)
					sender = getattr(signature, 'sender', None)
					if other_account:
						addresses.add(str(Address(other_account)))
					if sender:
						addresses.add(str(self._convert_public_key_to_address(sender)))

			# Handle multisig modifications
			if hasattr(transaction, 'modifications'):
				for modification in transaction.modifications:
					cosignatory = getattr(modification, 'cosignatory_account', None)
					if cosignatory:
						addresses.add(str(self._convert_public_key_to_address(cosignatory)))

		# Block signer
		block_signer = getattr(block, 'signer', None)
		if block_signer:
			addresses.add(str(self._convert_public_key_to_address(block_signer)))

		# Block transactions
		for transaction in block.transactions:
			_extract_from_transaction(transaction)

			if hasattr(transaction, 'other_transaction'):
				_extract_from_transaction(transaction.other_transaction)

		return addresses

	def _commit_blocks(self, message=None):
		"""Commit blocks to database with error handling."""

		self.nem_db.connection.commit()
		if message:
			log.info(message)

	def _process_block(self, cursor, block_data):
		"""Process block data."""

		timestamp = self._convert_timestamp_to_datetime(block_data.timestamp)

		block = BlockRecord(
			block_data.height,
			timestamp,
			block_data.total_fee,
			len(block_data.transactions),
			block_data.difficulty,
			block_data.block_hash,
			block_data.beneficiary,
			block_data.signer,
			block_data.signature,
			block_data.size
		)

		self.nem_db.insert_block(cursor, block)

	def _convert_mosaics_to_json(self, account_mosaics):  # pylint: disable=no-self-use
		"""Convert AccountMosaic to Json format."""

		return [
			{
				'namespace': f'{mosaic.mosaic_id[0]}.{mosaic.mosaic_id[1]}',
				'quantity': mosaic.quantity
			}
			for mosaic in account_mosaics
		]

	def _create_account_record(self, account_info, mosaics_json, remote_address=None):  # pylint: disable=no-self-use
		"""Create AccountRecord from account info and mosaics."""

		return AccountRecord(
			account_info.address,
			account_info.public_key,
			remote_address,
			account_info.importance,
			account_info.balance,
			account_info.vested_balance,
			mosaics_json,
			account_info.harvested_blocks,
			account_info.status,
			account_info.remote_status,
			account_info.min_cosignatories,
			account_info.cosignatory_of,
			account_info.cosignatories
		)

	async def _process_account_batch(self, cursor, addresses):
		"""
		Process a batch of addresses: fetch account info, mosaics, and upsert.
		Updates both new and existing accounts with latest information.
		"""

		log.info(f'Processing batch of {len(addresses)} addresses')

		# Fetch account info for all addresses (both new and existing)
		for address in addresses:
			account_info = await self._retry_get_account_info(address)
			account_mosaics = await self._retry_get_account_mosaics(address)

			mosaics_json = self._convert_mosaics_to_json(account_mosaics)
			account = self._create_account_record(account_info, mosaics_json)

			self.nem_db.upsert_account(cursor, account)

			if 'REMOTE' == account_info.remote_status:
				# Try fetching forwarded account info if remote status is REMOTE
				main_account_info = await self._retry_get_account_info(address, forwarded=True)
				main_account_mosaics = await self._retry_get_account_mosaics(str(main_account_info.address))

				main_mosaics_json = self._convert_mosaics_to_json(main_account_mosaics)
				main_account = self._create_account_record(main_account_info, main_mosaics_json, remote_address=account.address)

				self.nem_db.upsert_account(cursor, main_account)

	async def sync_nemesis_block(self):
		"""Sync and write Nemesis block to database."""

		nemesis_block = await self.nem_connector.get_block(1)

		cursor = self.nem_db.connection.cursor()

		self._process_block(cursor, nemesis_block)

		addresses = self._extract_addresses_from_block(nemesis_block)
		await self._process_account_batch(cursor, addresses)

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
				block_queue.task_done()
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

	async def _retry_get_blocks_after(self, height, retries=3, delay=2):
		"""Retries fetching blocks after a given height with exponential backoff."""

		for attempt in range(1, retries + 1):
			try:
				return await self.nem_connector.get_blocks_after(height)
			except NodeException as error:
				if attempt < retries:
					wait_time = delay * (2 ** (attempt - 1))  # Exponential backoff: 2s, 4s, 8s
					log.warning(f'Error fetching blocks after height {height} (attempt {attempt}/{retries}): {error}. Retrying in {wait_time}s...')
					await asyncio.sleep(wait_time)
				else:
					log.error(f'Failed to fetch blocks after height {height} after {retries} attempts: {error}')
					raise

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
				blocks = await self._retry_get_blocks_after(db_height)

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
