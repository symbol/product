import configparser
import json

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Network
from symbollightapi.connector.NemConnector import NemConnector
from zenlog import log

from db.NemDatabase import NemDatabase
from model.Block import Block
from model.Transaction import (
	AccountKeyLinkTransaction,
	MultisigAccountModificationTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	Transaction,
	TransferTransaction
)


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
		total_fees = sum(transaction.fee for transaction in block_data.transactions)

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

	def _store_transactions(self, cursor, transactions):
		"""Store transactions data."""

		for transaction in transactions:
			timestamp = Block.convert_timestamp_to_datetime(self.nem_facade, transaction.timestamp)
			deadline = Block.convert_timestamp_to_datetime(self.nem_facade, transaction.deadline)

			transaction_common = Transaction(
				transaction.transaction_hash,
				transaction.height,
				transaction.sender,
				transaction.fee,
				timestamp,
				deadline,
				transaction.signature,
				transaction.transaction_type,
			)

			if TransactionType.TRANSFER.value == transaction.transaction_type:
				# checking message first byte "fe" (HEX:) for apostille
				is_apostille = (
					transaction.recipient == 'NCZSJHLTIMESERVBVKOW6US64YDZG2PFGQCSV23J' and
					transaction.message[0][:2] == 'fe' and
					transaction.message[1] == 1
				)

				mosaics = json.dumps([mosaic._asdict() for mosaic in transaction.mosaics]) if transaction.mosaics else None

				transfer_transaction = TransferTransaction(
					transaction.amount,
					transaction.recipient,
					mosaics,
					json.dumps(transaction.message._asdict()),
					is_apostille
				)

				transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

				self.nem_db.insert_transfer_transactions(cursor, transaction_id, transfer_transaction)

			elif TransactionType.ACCOUNT_KEY_LINK.value == transaction.transaction_type:
				account_key_link_transaction = AccountKeyLinkTransaction(
					transaction.mode,
					transaction.remote_account
				)

				transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

				self.nem_db.insert_account_key_link_transactions(cursor, transaction_id, account_key_link_transaction)

			elif TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value == transaction.transaction_type:
				multisig_account_modification_transaction = MultisigAccountModificationTransaction(
					transaction.min_cosignatories,
					json.dumps([modification._asdict() for modification in transaction.modifications])
				)

				transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

				self.nem_db.insert_multisig_account_modification_transactions(cursor, transaction_id, multisig_account_modification_transaction)

			elif TransactionType.MULTISIG.value == transaction.transaction_type:
				multisig_transaction = MultisigTransaction(
					json.dumps([signature.__dict__ for signature in transaction.signatures]),
					json.dumps(transaction.other_transaction.__dict__),
					transaction.inner_hash,
				)

				transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

				self.nem_db.insert_multisig_transactions(cursor, transaction_id, multisig_transaction)

			elif TransactionType.NAMESPACE_REGISTRATION.value == transaction.transaction_type:
				namespace_registration_transaction = NamespaceRegistrationTransaction(
					transaction.rental_fee_sink,
					transaction.rental_fee,
					transaction.parent,
					transaction.namespace,
				)

				transaction_id = self.nem_db.insert_transaction(cursor, transaction_common)

				self.nem_db.insert_namespace_registration_transactions(cursor, transaction_id, namespace_registration_transaction)

	async def sync_nemesis_block(self):
		"""Sync the Nemesis block."""

		nemesis_block = await self.nem_connector.get_block(1)

		# initialize cursor
		cursor = self.nem_db.connection.cursor()

		self._store_block(cursor, nemesis_block)
		self._store_transactions(cursor, nemesis_block.transactions)

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
				self._store_transactions(cursor, block.transactions)

			# commit changes
			self.nem_db.connection.commit()

			db_height = blocks[-1].height
			first_block_height = blocks[0].height

			log.info(f'added block from height {first_block_height} - {db_height}')
