import asyncio
import configparser
import threading
from collections import namedtuple
from queue import Queue

from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import TransactionType
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
NamespaceRecord = namedtuple('NamespaceRecord', [
	'root_namespace',
	'owner',
	'registered_height',
	'expiration_height'
])
MosaicRecord = namedtuple('MosaicRecord', [
	'root_namespace',
	'namespace_name',
	'description',
	'creator',
	'registered_height',
	'initial_supply',
	'total_supply',
	'divisibility',
	'supply_mutable',
	'transferable',
	'levy_type',
	'levy_namespace_name',
	'levy_fee',
	'levy_recipient'
])
TransactionRecord = namedtuple('TransactionRecord', [
	'transaction_hash',
	'height',
	'sender_public_key',
	'fee',
	'timestamp',
	'deadline',
	'signature',
	'amount',
	'transaction_type',
	'is_inner',
	'inner_transaction_id',
	'sender_address',
	'recipient_address',
	'payload'
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

	@staticmethod
	async def _retry_operation(operation, description, retries=3, delay=2):
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
					addresses.add(str(Address(signature.other_account)))
					addresses.add(str(self._convert_public_key_to_address(signature.sender)))

			# Handle multisig modifications
			if hasattr(transaction, 'modifications'):
				for modification in transaction.modifications:
					addresses.add(str(self._convert_public_key_to_address(modification.cosignatory_account)))

		# Block signer
		addresses.add(str(self._convert_public_key_to_address(block.signer)))

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

	@staticmethod
	def _convert_mosaics_to_json(account_mosaics):
		"""Convert AccountMosaic to Json format."""

		return [
			{
				'namespace': f'{mosaic.mosaic_id[0]}.{mosaic.mosaic_id[1]}',
				'quantity': mosaic.quantity
			}
			for mosaic in account_mosaics
		]

	@staticmethod
	def _create_account_record(account_info, mosaics_json, remote_address=None):
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

	def _process_harvested_fees(self, cursor, accounts_harvested_fee):  # pylint: disable=no-self-use
		"""Process harvested fees for accounts."""

		for beneficiary, (total_fees, last_height) in accounts_harvested_fee.items():
			self.nem_db.update_account_harvested_fees(
				cursor,
				beneficiary,
				total_fees,
				last_height
			)

	def _process_root_namespace(self, cursor, transaction, block_height):
		"""Process root namespace data."""

		# add 1 year to expired height
		expired_height = block_height + (365 * 1440)

		namespace = NamespaceRecord(
			root_namespace=transaction.namespace,
			owner=transaction.sender,
			registered_height=block_height,
			expiration_height=expired_height
		)

		self.nem_db.upsert_namespace(cursor, namespace)

	def _process_sub_namespace(self, cursor, transaction):
		"""Process sub namespace data."""

		root_namespace = transaction.parent.split('.')[0]

		new_sub_namespace = f'{transaction.parent}.{transaction.namespace}'
		self.nem_db.update_sub_namespaces(cursor, new_sub_namespace, root_namespace)

	def _process_namespace(self, cursor, transaction, block_height):
		"""Process namespace in a block."""

		if transaction.parent:
			self._process_sub_namespace(cursor, transaction)
		else:
			self._process_root_namespace(cursor, transaction, block_height)

	def _process_mosaic_definition(self, cursor, transaction, block_height):
		"""Process mosaic definition in a block."""

		mosaic_properties = transaction.properties
		levy_properties = transaction.levy

		mosaic = MosaicRecord(
			root_namespace=transaction.namespace_name.split('.')[0],
			namespace_name=transaction.namespace_name,
			description=transaction.description,
			creator=transaction.creator,
			registered_height=block_height,
			initial_supply=mosaic_properties.initial_supply,
			total_supply=mosaic_properties.initial_supply,
			divisibility=mosaic_properties.divisibility,
			supply_mutable=mosaic_properties.supply_mutable,
			transferable=mosaic_properties.transferable,
			levy_type=levy_properties.type if levy_properties else None,
			levy_namespace_name=levy_properties.namespace_name if levy_properties else None,
			levy_fee=levy_properties.fee if levy_properties else None,
			levy_recipient=levy_properties.recipient if levy_properties else None
		)

		self.nem_db.upsert_mosaic(cursor, mosaic)

	def _process_mosaic_supply_change(self, cursor, transaction):
		"""Process mosaic supply change in a block."""

		adjustment = transaction.delta if transaction.supply_type == 1 else -transaction.delta
		self.nem_db.update_mosaic_total_supply(cursor, transaction.namespace_name, adjustment)

	def _build_transaction_record(self, transaction, is_inner, inner_transaction_id=None):
		"""Create TransactionRecord from transaction data."""

		payload = None
		recipient_address = None
		amount = None
		if transaction.transaction_type == TransactionType.TRANSFER.value:
			payload = {
				'message': {
					'payload': transaction.message.payload,
					'is_plain': transaction.message.is_plain,
				} if transaction.message else None
			}
			recipient_address = transaction.recipient
			amount = transaction.amount
		elif transaction.transaction_type == TransactionType.ACCOUNT_KEY_LINK.value:
			payload = {
				'mode': transaction.mode,
				'remote_account': str(transaction.remote_account)
			}
		elif transaction.transaction_type == TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value:
			payload = {
				'min_cosignatories': transaction.min_cosignatories,
				'modifications': [
					{
						'modification_type': modification.modification_type,
						'cosignatory_account': str(modification.cosignatory_account)
					}
					for modification in transaction.modifications
				]
			}
		elif transaction.transaction_type == TransactionType.MULTISIG.value:
			payload = {
				'inner_hash': transaction.inner_hash,
				'signatures': [
					{
						'transaction_type': signature.transaction_type,
						'timestamp': self._convert_timestamp_to_datetime(signature.timestamp),
						'deadline': self._convert_timestamp_to_datetime(signature.deadline),
						'fee': signature.fee,
						'other_hash': signature.other_hash,
						'other_account': str(signature.other_account),
						'sender': str(signature.sender),
						'signature': signature.signature
					} for signature in transaction.signatures
				]
			}
		elif transaction.transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			payload = {
				'rental_fee': transaction.rental_fee,
				'parent': transaction.parent,
				'namespace': transaction.namespace
			}
			recipient_address = transaction.rental_fee_sink
		elif transaction.transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			payload = {
				'creation_fee': transaction.creation_fee,
				'creator': str(transaction.sender),
				'description': transaction.description,
				'namespace_name': transaction.namespace_name,
				'mosaic_properties': {
					'divisibility': transaction.properties.divisibility,
					'initial_supply': transaction.properties.initial_supply,
					'supply_mutable': transaction.properties.supply_mutable,
					'transferable': transaction.properties.transferable
				},
				'levy': {
					'type': transaction.levy.type,
					'namespace_name': transaction.levy.namespace_name,
					'fee': transaction.levy.fee,
					'recipient': str(transaction.levy.recipient)
				} if transaction.levy else None
			}
			recipient_address = transaction.creation_fee_sink
		elif transaction.transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			payload = {
				'namespace_name': transaction.namespace_name,
				'supply_type': transaction.supply_type,
				'delta': transaction.delta
			}

		return TransactionRecord(
			transaction_hash=transaction.transaction_hash,
			height=transaction.height,
			sender_public_key=transaction.sender,
			fee=transaction.fee,
			timestamp=self._convert_timestamp_to_datetime(transaction.timestamp),
			deadline=self._convert_timestamp_to_datetime(transaction.deadline),
			amount=amount,
			signature=transaction.signature,
			transaction_type=transaction.transaction_type,
			is_inner=is_inner,
			inner_transaction_id=inner_transaction_id,  # to be updated after insertion if it's an inner transaction
			sender_address=transaction.sender,
			recipient_address=recipient_address,
			payload=payload
		)

	def _process_transaction(self, cursor, transaction, block_height, is_inner, inner_transaction_id=None):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		"""Process a single transaction."""

		transaction_record = self._build_transaction_record(transaction, is_inner, inner_transaction_id)
		transaction_id = self.nem_db.insert_transaction(cursor, transaction_record)

		if transaction.transaction_type == TransactionType.TRANSFER.value and transaction.mosaics:
			for mosaic in transaction.mosaics:
				self.nem_db.insert_transaction_mosaic(cursor, transaction_id, mosaic)
		elif transaction.transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			self._process_namespace(cursor, transaction, block_height)
		elif transaction.transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			self._process_mosaic_definition(cursor, transaction, block_height)
		elif transaction.transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			self._process_mosaic_supply_change(cursor, transaction)

		return transaction_id

	def _process_transactions(self, cursor, block_transactions, height):
		"""Process transactions in a block."""

		for transaction in block_transactions:
			inner_transaction_id = None

			# Handle inner transaction first to get its ID for linking
			if hasattr(transaction, 'other_transaction'):
				# For inner transactions, we set the transaction hash to the inner hash
				transaction.other_transaction.transaction_hash = transaction.inner_hash
				transaction.other_transaction.height = transaction.height
				inner_transaction_id = self._process_transaction(cursor, transaction=transaction.other_transaction, block_height=height, is_inner=True)

			self._process_transaction(
				cursor,
				transaction=transaction,
				block_height=height,
				is_inner=False,
				inner_transaction_id=inner_transaction_id
			)

	async def sync_nemesis_block(self):
		"""Sync and write Nemesis block to database."""

		nemesis_block = await self.nem_connector.get_block(1)

		cursor = self.nem_db.connection.cursor()

		self._process_block(cursor, nemesis_block)

		addresses = self._extract_addresses_from_block(nemesis_block)
		await self._process_account_batch(cursor, addresses)

		self._process_transactions(cursor, nemesis_block.transactions, nemesis_block.height)

		self._commit_blocks('Committed Nemesis block')

	def _db_writer(self, block_queue, batch_size=50):
		"""
		Consumer blocks from queue and write to database in batches.
		"""

		cursor = self.nem_db.connection.cursor()
		processed = 0
		pending_addresses = set()
		accounts_harvested_fee = {}

		log.info('DB writer thread started')

		while True:
			# retrieve block from queue
			block = block_queue.get()

			# Check for sentinel value (None) to stop processing
			if block is None:
				log.info('Received stop signal, ending DB writer thread')

				# Process any remaining addresses before exiting
				if pending_addresses:
					asyncio.run(self._process_account_batch(cursor, pending_addresses))

				block_queue.task_done()
				break

			# Process and insert block
			self._process_block(cursor, block)
			processed += 1

			# Extract addresses for account processing
			addresses = self._extract_addresses_from_block(block)
			pending_addresses.update(addresses)

			# Track beneficiary harvested fees
			current_fees, _ = accounts_harvested_fee.get(block.beneficiary, (0, 0))
			accounts_harvested_fee[block.beneficiary] = (
				current_fees + block.total_fee,
				block.height
			)

			self._process_transactions(cursor, block.transactions, block.height)

			# Batch commits
			if processed % batch_size == 0:
				asyncio.run(self._process_account_batch(cursor, pending_addresses))
				pending_addresses.clear()

				self._process_harvested_fees(cursor, accounts_harvested_fee)
				accounts_harvested_fee.clear()

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
