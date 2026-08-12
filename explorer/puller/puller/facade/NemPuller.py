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
from symbollightapi.model.Transaction import Mosaic
from zenlog import log

from puller.db.NemDatabase import NemDatabase

ACCOUNT_KEY_LINK_MODE_ACTIVATE = 1
NEM_MAX_ROLLBACK_DEPTH = 360


class NemRollbackError(RuntimeError):
	"""Raised when a NEM rollback cannot safely proceed."""


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
	'height',
	'public_key',
	'remote_address',
	'importance',
	'balance',
	'vested_balance',
	'mosaics',
	'harvested_blocks',
	'remote_status',
	'min_cosignatories',
	'cosignatory_of',
	'cosignatories'
])
AccountVestedBalanceRecord = namedtuple('AccountVestedBalanceRecord', [
	'address',
	'importance',
	'vested_balance'
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
	'transaction_type',
	'is_inner',
	'sender_address',
	'recipient_address',
	'payload',
	'size',
	'version'
])
RollbackPayloadAccounts = namedtuple('RollbackPayloadAccounts', [
	'accounts',
	'remote_link_accounts'
])
RollbackProjectionIdentifiers = namedtuple('RollbackProjectionIdentifiers', [
	'namespace_roots',
	'mosaic_names'
])
NemRollbackImpact = namedtuple('NemRollbackImpact', [
	'fork_height',
	'affected_accounts',
	'account_creation_heights',
	'orphan_created_accounts',
	'surviving_affected_accounts',
	'orphan_beneficiaries',
	'affected_remote_link_accounts',
	'affected_namespace_roots',
	'affected_mosaic_names'
])
DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


def _format_xem_absolute(relative_amount):
	"""Convert relative XEM amount to absolute."""

	return relative_amount * (10 ** 6)


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

	async def _retry_get_block(self, height, retries=3, delay=2):
		"""Retries fetching a block at a specific height with exponential backoff."""

		return await self._retry_operation(
			lambda: self.nem_connector.get_block(height),
			f'fetching block at height {height}',
			retries,
			delay
		)

	async def detect_rollback(self, db_height, chain_height):
		"""Returns the fork height when rollback is detected, otherwise None."""

		comparison_height = min(db_height, chain_height)
		minimum_height = max(1, db_height - NEM_MAX_ROLLBACK_DEPTH)

		for height in range(comparison_height, minimum_height - 1, -1):
			db_block_hash = self.nem_db.get_block_hash(height)
			node_block = await self._retry_get_block(height)

			if db_block_hash.lower() == node_block.block_hash.lower():
				return None if height == db_height else height

		raise NemRollbackError(
			f'No matching NEM block hash found within {NEM_MAX_ROLLBACK_DEPTH} blocks '
			f'(database height: {db_height}, chain height: {chain_height}); '
			'manual investigation is required'
		)

	def _extract_affected_payload_accounts(self, transaction):
		"""Extracts account addresses stored only in an orphan transaction payload."""

		affected_accounts = set()
		affected_remote_link_accounts = set()

		if TransactionType.ACCOUNT_KEY_LINK.value == transaction.transaction_type:
			affected_remote_link_accounts.add(transaction.sender_address)
			affected_accounts.add(
				self._convert_public_key_to_address(transaction.payload['remote_account'])
			)
		elif TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value == transaction.transaction_type:
			for modification in transaction.payload['modifications']:
				affected_accounts.add(
					self._convert_public_key_to_address(modification['cosignatory_account'])
				)
		elif TransactionType.MULTISIG.value == transaction.transaction_type:
			signatures = transaction.payload['signatures']
			if signatures:
				affected_accounts.add(Address(signatures[0]['other_account']))

			for signature in signatures:
				affected_accounts.add(self._convert_public_key_to_address(signature['sender']))
		elif TransactionType.MOSAIC_DEFINITION.value == transaction.transaction_type:
			levy = transaction.payload['levy']
			if levy:
				affected_accounts.add(Address(levy['recipient']))

		return RollbackPayloadAccounts(affected_accounts, affected_remote_link_accounts)

	@staticmethod
	def _extract_affected_projection_identifiers(transaction):
		"""Extracts projection identifiers changed by an orphan transaction."""

		affected_namespace_roots = set()
		affected_mosaic_names = set()

		if TransactionType.NAMESPACE_REGISTRATION.value == transaction.transaction_type:
			parent = transaction.payload['parent']
			if parent:
				affected_namespace_roots.add(parent.split('.')[0])
			else:
				affected_namespace_roots.add(transaction.payload['namespace'])
		elif transaction.transaction_type in (
			TransactionType.MOSAIC_DEFINITION.value,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value
		):
			affected_mosaic_names.add(transaction.payload['namespace_name'])

		return RollbackProjectionIdentifiers(affected_namespace_roots, affected_mosaic_names)

	@staticmethod
	def _validate_account_creation_heights(affected_accounts, account_creation_heights):
		"""Requires every affected account to have a stored creation height."""

		missing_accounts = affected_accounts - set(account_creation_heights)
		if missing_accounts:
			raise NemRollbackError(
				f'Missing creation heights for {len(missing_accounts)} affected NEM account(s)'
			)

	def capture_rollback_impact(self, fork_height):  # pylint: disable=too-many-locals
		"""Captures the complete local impact of blocks above a confirmed fork height."""

		if fork_height < 1:
			raise NemRollbackError(f'Invalid NEM fork height {fork_height}')

		affected_accounts = set()
		orphan_beneficiaries = set()
		affected_remote_link_accounts = set()
		affected_namespace_roots = set()
		affected_mosaic_names = set()
		orphan_created_accounts = set()
		surviving_affected_accounts = set()

		orphan_records = self.nem_db.get_orphan_chain_records(fork_height)

		for block in orphan_records.blocks:
			orphan_beneficiaries.add(block.beneficiary)
			affected_accounts.add(block.beneficiary)
			affected_accounts.add(self._convert_public_key_to_address(block.signer))

		for transaction in orphan_records.transactions:
			affected_accounts.add(transaction.sender_address)
			if transaction.recipient_address:
				affected_accounts.add(transaction.recipient_address)

			payload_accounts = self._extract_affected_payload_accounts(transaction)
			affected_accounts.update(payload_accounts.accounts)
			affected_remote_link_accounts.update(payload_accounts.remote_link_accounts)

			projection_identifiers = self._extract_affected_projection_identifiers(transaction)
			affected_namespace_roots.update(projection_identifiers.namespace_roots)
			affected_mosaic_names.update(projection_identifiers.mosaic_names)

		affected_accounts.update(orphan_records.transfer_levy_recipients)

		account_creation_heights = self.nem_db.get_account_creation_heights(affected_accounts)
		self._validate_account_creation_heights(affected_accounts, account_creation_heights)

		for address, height in account_creation_heights.items():
			if height > fork_height:
				orphan_created_accounts.add(address)
			else:
				surviving_affected_accounts.add(address)

		return NemRollbackImpact(
			fork_height,
			affected_accounts,
			account_creation_heights,
			orphan_created_accounts,
			surviving_affected_accounts,
			orphan_beneficiaries,
			affected_remote_link_accounts,
			affected_namespace_roots,
			affected_mosaic_names
		)

	async def prefetch_rollback_account_state(self, rollback_impact):
		"""Fetches current node state for all affected accounts that survive a rollback."""

		account_state = {}
		for address in rollback_impact.surviving_affected_accounts:
			account_state[address] = await self._fetch_account_record(
				str(address),
				rollback_impact.account_creation_heights[address]
			)

		return account_state

	@staticmethod
	def _validate_rollback_account_state(rollback_impact, account_state):
		"""Requires one correctly identified node snapshot for every surviving account."""

		expected_addresses = rollback_impact.surviving_affected_accounts
		actual_addresses = set(account_state)
		if expected_addresses != actual_addresses:
			raise NemRollbackError(
				'Rollback account snapshot does not match surviving affected accounts'
			)

		for address, account in account_state.items():
			if address != account.address:
				raise NemRollbackError(f'Rollback account snapshot address mismatch for {address}')

			if rollback_impact.account_creation_heights[address] != account.height:
				raise NemRollbackError(f'Rollback account snapshot height mismatch for {address}')

	def _restore_rollback_remote_addresses(self, cursor, rollback_impact):
		"""Restores affected remote links from surviving account-key-link history."""

		addresses = rollback_impact.affected_remote_link_accounts
		self.nem_db.clear_account_remote_addresses(cursor, addresses)

		transactions = self.nem_db.get_surviving_account_key_links(
			cursor,
			rollback_impact.fork_height,
			addresses
		)
		for transaction in transactions:
			remote_address = (
				self._convert_public_key_to_address(transaction.payload['remote_account'])
				if ACCOUNT_KEY_LINK_MODE_ACTIVATE == transaction.payload['mode'] else None
			)
			self.nem_db.update_account_remote_address(
				cursor,
				transaction.sender_address,
				remote_address
			)

	def repair_rollback(self, rollback_impact, account_state):
		"""Atomically restores NEM database state to a confirmed fork height."""

		self._validate_rollback_account_state(rollback_impact, account_state)
		cursor = self.nem_db.connection.cursor()

		try:
			self.nem_db.delete_orphan_chain_data(cursor, rollback_impact.fork_height)
			self.nem_db.delete_accounts(cursor, rollback_impact.orphan_created_accounts)

			for address in sorted(account_state, key=str):
				self.nem_db.refresh_account_from_snapshot(cursor, account_state[address])

			self._restore_rollback_remote_addresses(cursor, rollback_impact)

			# Todo: reconstruct_rollback_namespaces, reconstruct_rollback_mosaics, recalculate_account_harvesting

			self.nem_db.connection.commit()
		except Exception:
			self.nem_db.connection.rollback()
			raise

	async def _retry_get_account_info(self, address, retries=3, delay=2):
		"""Retries fetching account info with exponential backoff."""

		return await self._retry_operation(
			lambda: self.nem_connector.account_info(address),
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

	def _extract_addresses_from_block(self, cursor, block):
		"""Extract address and public key from block and transactions."""

		addresses = set()
		transferred_mosaic_names = set()  # track transferred mosaic names for levy recipient lookup

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

			if transaction.transaction_type == TransactionType.TRANSFER.value and transaction.mosaics:
				for mosaic in transaction.mosaics:
					if mosaic.namespace_name != 'nem.xem':
						transferred_mosaic_names.add(mosaic.namespace_name)

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
		addresses.add(str(block.beneficiary))

		# Block transactions
		for transaction in block.transactions:
			_extract_from_transaction(transaction)

			if hasattr(transaction, 'other_transaction'):
				_extract_from_transaction(transaction.other_transaction)

		for recipient in self.nem_db.get_mosaic_levy_recipients(cursor, transferred_mosaic_names):
			addresses.add(str(recipient))

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
				'namespace_name': f'{mosaic.mosaic_id[0]}.{mosaic.mosaic_id[1]}',
				'quantity': mosaic.quantity
			}
			for mosaic in account_mosaics
		]

	@staticmethod
	def _create_account_record(account_info, mosaics_json, height):
		"""Create AccountRecord from account info and mosaics."""

		return AccountRecord(
			account_info.address,
			height,
			account_info.public_key,
			None,
			account_info.importance,
			_format_xem_absolute(account_info.balance),
			_format_xem_absolute(account_info.vested_balance),
			mosaics_json,
			account_info.harvested_blocks,
			account_info.remote_status,
			account_info.min_cosignatories,
			account_info.cosignatory_of,
			account_info.cosignatories
		)

	async def _fetch_account_record(self, address, height):
		"""Fetches current node state and creates a complete account record."""

		account_info = await self._retry_get_account_info(address)
		account_mosaics = await self._retry_get_account_mosaics(address)
		mosaics_json = self._convert_mosaics_to_json(account_mosaics)

		return self._create_account_record(account_info, mosaics_json, height)

	@staticmethod
	def _create_account_vested_balance_record(account_info):
		"""Create account vested balance record."""

		return AccountVestedBalanceRecord(
			account_info.address,
			account_info.importance,
			_format_xem_absolute(account_info.vested_balance)
		)

	async def _process_account_batch(self, cursor, address_heights):
		"""
		Process a batch of addresses: fetch account info, mosaics, and upsert.
		Updates both new and existing accounts with latest information.
		"""

		log.info(f'Processing batch of {len(address_heights)} addresses')

		# Fetch account info for all addresses (both new and existing)
		for address, height in address_heights.items():
			account = await self._fetch_account_record(address, height)
			self.nem_db.upsert_account(cursor, account)

	@staticmethod
	def _add_pending_addresses(pending_addresses, addresses, height):
		"""Adds addresses to pending account processing with their earliest recovered height."""

		for address in addresses:
			if address not in pending_addresses:
				pending_addresses[address] = height

	def _process_harvested_fees(self, cursor, accounts_harvested_fee):  # pylint: disable=no-self-use
		"""Process harvested fees for accounts."""

		for beneficiary, (total_fees, last_height) in accounts_harvested_fee.items():
			self.nem_db.update_account_harvested_fees(
				cursor,
				beneficiary,
				total_fees,
				last_height
			)

	def _flush_pending_account_state(self, cursor, pending_addresses, accounts_harvested_fee):
		"""Flushes accumulated account and harvested fee state, clearing both accumulators."""

		if pending_addresses:
			asyncio.run(self._process_account_batch(cursor, pending_addresses))
			pending_addresses.clear()

		if accounts_harvested_fee:
			self._process_harvested_fees(cursor, accounts_harvested_fee)
			accounts_harvested_fee.clear()

	async def refresh_accounts(self, batch_size):
		"""Refresh vested balance and importance for stored accounts."""

		cursor = self.nem_db.connection.cursor()
		last_account_id = 0
		total_refreshed = 0

		while True:
			accounts = self.nem_db.get_accounts_for_refresh(batch_size, last_account_id)
			if not accounts:
				break

			for account in accounts:
				account_info = await self._retry_get_account_info(str(account.address))
				account_vested_balance = self._create_account_vested_balance_record(account_info)
				self.nem_db.update_vested_balance_and_importance(cursor, account_vested_balance)
				last_account_id = account.id
				total_refreshed += 1

			self.nem_db.connection.commit()
			log.info(f'Refreshed {len(accounts)} accounts in current batch, {total_refreshed} total')

		return total_refreshed

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

	def _process_account_key_link(self, cursor, transaction):
		"""Apply a remote link change announced by an account key link transaction."""

		main_address = self._convert_public_key_to_address(transaction.sender)
		remote_address = (
			self._convert_public_key_to_address(transaction.remote_account)
			if ACCOUNT_KEY_LINK_MODE_ACTIVATE == transaction.mode else None
		)

		self.nem_db.update_account_remote_address(cursor, main_address, remote_address)

	def _process_mosaic_supply_change(self, cursor, transaction):
		"""Process mosaic supply change in a block."""

		adjustment = transaction.delta if transaction.supply_type == 1 else -transaction.delta
		self.nem_db.update_mosaic_total_supply(cursor, transaction.namespace_name, adjustment)

	def _build_transaction_record(self, transaction, is_inner):
		"""Create TransactionRecord from transaction data."""

		payload = None
		recipient_address = None
		if transaction.transaction_type == TransactionType.TRANSFER.value:
			payload = {
				'message': {
					'payload': transaction.message.payload,
					'type': transaction.message.type,
				} if transaction.message else None
			}
			recipient_address = transaction.recipient
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
			signature=transaction.signature,
			transaction_type=transaction.transaction_type,
			is_inner=is_inner,
			sender_address=self._convert_public_key_to_address(transaction.sender),
			recipient_address=recipient_address,
			payload=payload,
			size=transaction.size,
			version=transaction.version
		)

	def _process_transaction(self, cursor, transaction, block_height, is_inner):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		"""Process a single transaction."""

		transaction_record = self._build_transaction_record(transaction, is_inner)
		transaction_id = self.nem_db.insert_transaction(cursor, transaction_record)

		if transaction.transaction_type == TransactionType.TRANSFER.value:
			if transaction.mosaics:
				for mosaic in transaction.mosaics:
					mosaic_amount = mosaic.quantity * transaction.amount // (10 ** 6)
					self.nem_db.insert_transaction_mosaic(
						cursor,
						transaction_id,
						Mosaic(mosaic.namespace_name, mosaic_amount)
					)
			else:
				# handle v1 transfer transaction
				self.nem_db.insert_transaction_mosaic(
					cursor,
					transaction_id,
					Mosaic('nem.xem', transaction.amount)
				)
		elif transaction.transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			self._process_namespace(cursor, transaction, block_height)
		elif transaction.transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			self._process_mosaic_definition(cursor, transaction, block_height)
		elif transaction.transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			self._process_mosaic_supply_change(cursor, transaction)
		elif transaction.transaction_type == TransactionType.ACCOUNT_KEY_LINK.value:
			self._process_account_key_link(cursor, transaction)

		return transaction_id

	def _process_transactions(self, cursor, block_transactions, height):
		"""Process transactions in a block."""

		for transaction in block_transactions:

			# Handle inner transaction first to get its ID for linking
			if hasattr(transaction, 'other_transaction'):
				# For inner transactions, we set the transaction hash to the inner hash
				transaction.other_transaction.transaction_hash = transaction.inner_hash
				transaction.other_transaction.height = transaction.height
				self._process_transaction(cursor, transaction=transaction.other_transaction, block_height=height, is_inner=True)

			self._process_transaction(
				cursor,
				transaction=transaction,
				block_height=height,
				is_inner=False
			)

	async def sync_nemesis_block(self):
		"""Sync and write Nemesis block to database."""

		nemesis_block = await self.nem_connector.get_block(1)

		cursor = self.nem_db.connection.cursor()

		self.nem_db.seed_network_currency(cursor, nemesis_block.signer)

		self._process_block(cursor, nemesis_block)

		addresses = self._extract_addresses_from_block(cursor, nemesis_block)
		await self._process_account_batch(cursor, {address: nemesis_block.height for address in addresses})

		self._process_transactions(cursor, nemesis_block.transactions, nemesis_block.height)

		self._commit_blocks('Committed Nemesis block')

	def _db_writer(self, block_queue, batch_size=50):
		"""
		Consumer blocks from queue and write to database in batches.
		"""

		cursor = self.nem_db.connection.cursor()
		processed = 0
		pending_addresses = {}
		accounts_harvested_fee = {}

		log.info('DB writer thread started')

		while True:
			# retrieve block from queue
			block = block_queue.get()

			# Check for sentinel value (None) to stop processing
			if block is None:
				log.info('Received stop signal, ending DB writer thread')

				# Process any remaining addresses and harvested fees before exiting
				self._flush_pending_account_state(cursor, pending_addresses, accounts_harvested_fee)

				block_queue.task_done()
				break

			# Process and insert block
			self._process_block(cursor, block)
			processed += 1

			# Extract addresses for account processing
			addresses = self._extract_addresses_from_block(cursor, block)
			self._add_pending_addresses(pending_addresses, addresses, block.height)

			# Track beneficiary harvested fees
			current_fees, _ = accounts_harvested_fee.get(block.beneficiary, (0, 0))
			accounts_harvested_fee[block.beneficiary] = (
				current_fees + block.total_fee,
				block.height
			)

			self._process_transactions(cursor, block.transactions, block.height)

			# Batch commits
			if processed % batch_size == 0:
				self._flush_pending_account_state(cursor, pending_addresses, accounts_harvested_fee)

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
