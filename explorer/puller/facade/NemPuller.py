import asyncio
import configparser
import json
import time

from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address, Network
from symbollightapi.connector.NemConnector import NemConnector
from zenlog import log

from db.NemDatabase import NemDatabase
from model.Account import Account
from model.Block import Block
from model.Mosaic import Mosaic
from model.Namespace import Namespace
from model.Transaction import Transaction, TransactionFactory

APOSTILLE_ADDRESS = 'NCZSJHLTIMESERVBVKOW6US64YDZG2PFGQCSV23J'


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
		self.network = network

	def _process_block(self, cursor, block_data):
		"""Process block data."""

		timestamp = Block.convert_timestamp_to_datetime(self.nem_facade, block_data.timestamp)
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

	def _process_mosaic_definition(self, cursor, transaction, block_height):
		"""Process mosaic definition data."""

		mosaic_properties = transaction.properties
		mosaic_levy = transaction.levy if transaction.levy else None
		root_namespace = transaction.namespace_name.split('.')[0]

		mosaic_definition = Mosaic(
			root_namespace,
			transaction.namespace_name,
			transaction.description,
			transaction.creator,
			block_height,
			mosaic_properties.initial_supply,
			mosaic_properties.initial_supply,  # initial supply as total supply when first insert
			mosaic_properties.divisibility,
			mosaic_properties.supply_mutable,
			mosaic_properties.transferable,
			mosaic_levy.type if mosaic_levy else None,
			mosaic_levy.namespace_name if mosaic_levy else None,
			mosaic_levy.fee if mosaic_levy else None,
			mosaic_levy.recipient if mosaic_levy else None,
		)

		self.nem_db.insert_mosaic(cursor, mosaic_definition)

	def _process_mosaic_supply_change(self, cursor, transaction):
		"""Process mosaic supply change data."""

		mosaic = self.nem_db.get_mosaic_by_namespace_name(cursor, transaction.namespace_name)

		if mosaic:
			adjustment = transaction.delta if transaction.supply_type == 1 else -transaction.delta
			mosaic.total_supply += adjustment
			self.nem_db.update_mosaic_total_supply(cursor, transaction.namespace_name, mosaic.total_supply)

	def _process_transfer_transaction(self, cursor, transaction_id, transaction):
		"""Process transfer transaction data."""

		message_dict = {}
		is_apostille = False

		if transaction.message is not None:
			message_dict = transaction.message._asdict()

			# checking message first byte "fe" (HEX:) for apostille
			message_first_byte = transaction.message[0][:2] == 'fe'
			# checking message type is plain text
			message_type = transaction.message[1] == 1

			is_apostille = transaction.recipient == APOSTILLE_ADDRESS and message_first_byte and message_type

		mosaics = json.dumps([mosaic._asdict() for mosaic in transaction.mosaics]) if transaction.mosaics else None

		transfer_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.amount,
			transaction.recipient,
			mosaics,
			json.dumps(message_dict),
			is_apostille
		)

		self.nem_db.insert_transactions_transfer(cursor, transaction_id, transfer_transaction)

	def _process_account_key_link_transaction(self, cursor, transaction_id, transaction):
		"""Process account key link transaction data."""

		account_key_link_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.mode,
			transaction.remote_account
		)

		self.nem_db.insert_transactions_account_key_link(cursor, transaction_id, account_key_link_transaction)

	def _process_multisig_account_modification_transaction(self, cursor, transaction_id, transaction):
		"""Process multisig account modification transaction data."""

		multisig_account_modification_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.min_cosignatories,
			json.dumps([modification._asdict() for modification in transaction.modifications])
		)

		self.nem_db.insert_transactions_multisig_account_modification(cursor, transaction_id, multisig_account_modification_transaction)

	def _process_multisig_transaction(self, cursor, transaction_id, transaction):
		"""Process multisig transaction data."""

		multisig_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.sender,
			json.dumps([signature.__dict__ for signature in transaction.signatures]),
			json.dumps(transaction.other_transaction.__dict__),
			transaction.inner_hash,
		)

		self.nem_db.insert_transactions_multisig(cursor, transaction_id, multisig_transaction)

	def _process_namespace_registration_transaction(self, cursor, transaction_id, transaction):
		"""Process namespace registration transaction data."""

		namespace_registration_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.rental_fee_sink,
			transaction.rental_fee,
			transaction.parent,
			transaction.namespace,
		)

		self.nem_db.insert_transactions_namespace_registration(cursor, transaction_id, namespace_registration_transaction)

	def _process_mosaic_definition_creation_transaction(self, cursor, transaction_id, transaction):
		"""Process mosaic definition creation transaction data."""

		mosaic_properties = transaction.properties
		mosaic_levy = transaction.levy if transaction.levy else None

		mosaic_definition_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.creation_fee_sink,
			transaction.creation_fee,
			transaction.creator,
			transaction.description,
			transaction.namespace_name,
			json.dumps(mosaic_properties._asdict()),
			json.dumps(mosaic_levy._asdict()) if mosaic_levy else None,
		)

		self.nem_db.insert_transactions_mosaic_definition_creation(cursor, transaction_id, mosaic_definition_transaction)

	def _process_mosaic_supply_change_transaction(self, cursor, transaction_id, transaction):
		"""Process mosaic supply change transaction data."""

		mosaic_supply_change_transaction = TransactionFactory.create_transaction(
			transaction.transaction_type,
			transaction.supply_type,
			transaction.delta,
			transaction.namespace_name,
		)

		self.nem_db.insert_transactions_mosaic_supply_change(cursor, transaction_id, mosaic_supply_change_transaction)

	def _process_root_namespace(self, cursor, transaction, block_height):
		"""Process root namespace data."""

		namespace = self.nem_db.get_namespace_by_root_namespace(cursor, transaction.namespace)

		# add 1 year to expired height
		expired_height = block_height + (365 * 1440)

		if namespace:
			self._update_existing_namespace(cursor, namespace, transaction, expired_height)
		else:
			self._create_new_root_namespace(cursor, transaction, block_height, expired_height)

	def _process_sub_namespace(self, cursor, transaction):
		"""Process sub namespace data."""

		root_namespace = transaction.parent.split('.')[0]
		namespace = self.nem_db.get_namespace_by_root_namespace(cursor, root_namespace)

		new_sub_namespace = f'{transaction.parent}.{transaction.namespace}'
		if new_sub_namespace not in namespace.sub_namespaces:
			namespace.sub_namespaces.append(new_sub_namespace)

		self.nem_db.update_namespace(cursor, namespace.root_namespace, sub_namespaces=namespace.sub_namespaces)

	def _create_new_root_namespace(self, cursor, transaction, block_height, expired_height):
		"""Create new root namespace."""

		# new namespace
		namespace = Namespace(
			transaction.namespace,
			transaction.sender,
			block_height,
			expired_height,
			[]
		)
		self.nem_db.insert_namespace(cursor, namespace)

	def _update_existing_namespace(self, cursor, namespace, transaction, expired_height):
		"""Update existing namespace."""

		if transaction.sender == namespace.owner:
			# renew namespace
			self.nem_db.update_namespace(cursor, namespace.root_namespace, expired_height)
		else:
			# update new owner
			self.nem_db.update_namespace(cursor, namespace.root_namespace, expired_height, [], transaction.sender)

	def _process_namespace(self, cursor, transaction, block_height):
		"""Process namespace data."""

		if transaction.parent:
			self._process_sub_namespace(cursor, transaction)
		else:
			self._process_root_namespace(cursor, transaction, block_height)

	def _convert_public_key_to_address(self, public_key):
		"""Convert public key to address."""

		return self.network.public_key_to_address(PublicKey(public_key))

	def _extract_addresses_from_block(self, block):
		"""Extract address and public key from block and transactions."""

		addresses = set()

		def add_public_key_from_attribute(obj, attribute_name):
			attribute_value = getattr(obj, attribute_name, None)
			if attribute_value:
				addresses.add(self._convert_public_key_to_address(attribute_value))

		def add_address_from_attribute(obj, attribute_name):
			attribute_value = getattr(obj, attribute_name, None)
			if attribute_value:
				addresses.add(Address(attribute_value))

		# Block signer
		add_public_key_from_attribute(block, 'signer')

		# Block transactions
		for transaction in block.transactions:
			add_public_key_from_attribute(transaction, 'sender')
			add_public_key_from_attribute(transaction, 'remote_account')
			add_address_from_attribute(transaction, 'recipient')

			for attribute_name in ['modifications', 'signatures']:
				attribute_value = getattr(transaction, attribute_name, [])
				for attribute in attribute_value:
					add_public_key_from_attribute(attribute, 'cosignatory_account' if attribute_name == 'modifications' else 'sender')

			other_transaction = getattr(transaction, 'other_transaction', None)
			if other_transaction:
				add_public_key_from_attribute(other_transaction, 'sender')
				add_public_key_from_attribute(other_transaction, 'remote_account')
				add_address_from_attribute(other_transaction, 'recipient')

		return addresses

	def _store_block(self, cursor, block):
		"""Store block data."""

		self._process_block(cursor, block)

	def _store_transactions(self, cursor, transactions):
		"""Store transactions data."""

		transaction_process_map = {
			TransactionType.TRANSFER.value: self._process_transfer_transaction,
			TransactionType.ACCOUNT_KEY_LINK.value: self._process_account_key_link_transaction,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: self._process_multisig_account_modification_transaction,
			TransactionType.MULTISIG.value: self._process_multisig_transaction,
			TransactionType.NAMESPACE_REGISTRATION.value: self._process_namespace_registration_transaction,
			TransactionType.MOSAIC_DEFINITION.value: self._process_mosaic_definition_creation_transaction,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: self._process_mosaic_supply_change_transaction,
		}

		for transaction in transactions:
			timestamp = Block.convert_timestamp_to_datetime(self.nem_facade, transaction.timestamp)
			deadline = Block.convert_timestamp_to_datetime(self.nem_facade, transaction.deadline)

			sender = transaction.sender
			if transaction.transaction_type == TransactionType.MULTISIG.value:
				# multisig address sender
				sender = transaction.other_transaction.sender

			transaction_common = Transaction(
				transaction.transaction_hash,
				transaction.height,
				sender,
				self.network.public_key_to_address(PublicKey(sender)),
				transaction.fee,
				timestamp,
				deadline,
				transaction.signature,
				transaction.transaction_type,
			)

			transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

			transaction_processor = transaction_process_map.get(transaction.transaction_type)

			transaction_processor(cursor, transaction_id, transaction)

	def _store_mosaics(self, cursor, transactions, block_height):
		"""Store mosaics."""

		for transaction in transactions:
			if TransactionType.MOSAIC_DEFINITION.value == transaction.transaction_type:
				self._process_mosaic_definition(cursor, transaction, block_height)
			elif TransactionType.MOSAIC_SUPPLY_CHANGE.value == transaction.transaction_type:
				self._process_mosaic_supply_change(cursor, transaction)

	def _store_namespaces(self, cursor, transactions, block_height):
		"""Store namespaces."""

		for transaction in transactions:
			if TransactionType.NAMESPACE_REGISTRATION.value == transaction.transaction_type:
				self._process_namespace(cursor, transaction, block_height)

	async def fetch_account_info_in_batches(self, addresses, batch_size=100):
		"""Fetch account info in batches."""

		address_list = list(addresses)

		batches = [address_list[i:i + batch_size] for i in range(0, len(address_list), batch_size)]
		all_account_infos = []

		for batch in batches:
			account_infos = await asyncio.gather(*[self.nem_connector.account_info(address) for address in batch])
			time.sleep(2)

			all_account_infos.extend(account_infos)

		return all_account_infos

	async def _update_account_info(self, cursor, addresses):
		"""Sync account info."""

		account_infos = await self.fetch_account_info_in_batches(addresses)

		for account in account_infos:
			remote_account_info = None

			mosaics = await self.nem_connector.account_mosaics(account.address)

			if account.remote_status == 'REMOTE':
				remote_account_info = await self.nem_connector.account_info(account.address, True)

			self.nem_db.update_account(cursor, account.address, Account(
				address=None,
				harvested_fees=None,
				height=None,
				last_harvested_height=None,
				remote_address=remote_account_info.address if remote_account_info is not None else None,
				public_key=account.public_key,
				importance=account.importance,
				balance=account.balance * 1000000,
				vested_balance=account.vested_balance * 1000000,
				mosaics=json.dumps([mosaic._asdict() for mosaic in mosaics]) if mosaics else None,
				harvested_blocks=account.harvested_blocks,
				harvest_status=account.harvest_status,
				harvest_remote_status=account.remote_status,
				min_cosignatories=account.min_cosignatories,
				cosignatory_of=account.cosignatory_of,
				cosignatories=account.cosignatories
			))

			log.info(f'updated account info for {account.address}')

	def _store_accounts(self, cursor, block_height, addresses):
		"""Store accounts."""

		for address in addresses:
			account = self.nem_db.get_account_by_address(cursor, address)

			if account is None:
				self.nem_db.insert_account(cursor, Account(
					address=address,
					height=block_height,
					public_key=None,
					remote_address=None,
					balance=0,
					vested_balance=0,
					importance=0,
					mosaics=None,
					harvested_fees=0,
					harvested_blocks=0,
					harvest_status=None,
					harvest_remote_status=None,
					min_cosignatories=None,
					cosignatory_of=None,
					cosignatories=None,
					last_harvested_height=0
				))

	async def _update_account_harvested_fee(self, cursor, block):
		"""Store account harvested fee."""

		total_fees = sum(transaction.fee for transaction in block.transactions)
		harvester_address = self._convert_public_key_to_address(block.signer)

		account = await self.nem_connector.account_info(harvester_address)

		# If account is remote, get remote account info
		if account.remote_status == 'REMOTE':
			remote_account_info = await self.nem_connector.account_info(account.address, True)
			harvester_address = remote_account_info.address

		harvester_account = self.nem_db.get_account_by_address(cursor, harvester_address)

		if harvester_account is not None and harvester_account.last_harvested_height < block.height:
			self.nem_db.update_account_harvested_fees(cursor, harvester_address, total_fees, block.height)
			log.info(f'updated account: {total_fees} fees harvested fee by {harvester_address} in height {block.height}')

	def _store_native_mosaic(self, cursor):
		self.nem_db.insert_mosaic(cursor, Mosaic(
			'nem',
			'nem.xem',
			'',
			'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
			1,
			8999999999,
			8999999999,
			6,
			False,
			True,
			None,
			None,
			None,
			None,
		))

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		nemesis_block = await self.nem_connector.get_block(1)

		# initialize cursor
		cursor = self.nem_db.connection.cursor()

		addresses_from_block = self._extract_addresses_from_block(nemesis_block)

		self._store_accounts(cursor, 1, addresses_from_block)
		self._store_block(cursor, nemesis_block)
		self._store_transactions(cursor, nemesis_block.transactions)
		self._store_native_mosaic(cursor)

		await self._update_account_harvested_fee(cursor, nemesis_block)
		await self._update_account_info(cursor, addresses_from_block)

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

			addresses = set()

			for block in blocks:
				addresses_from_block = self._extract_addresses_from_block(block)
				addresses.update(addresses_from_block)

				self._store_accounts(cursor, block.height, addresses_from_block)
				self._store_block(cursor, block)
				self._store_transactions(cursor, block.transactions)
				self._store_mosaics(cursor, block.transactions, block.height)
				self._store_namespaces(cursor, block.transactions, block.height)

				await self._update_account_harvested_fee(cursor, block)

			# sync account info
			await self._update_account_info(cursor, addresses)

			# commit changes
			self.nem_db.connection.commit()

			db_height = blocks[-1].height
			first_block_height = blocks[0].height

			log.info(f'added block from height {first_block_height} - {db_height}')
