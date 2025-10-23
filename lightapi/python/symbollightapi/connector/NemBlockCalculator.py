from binascii import unhexlify

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import MultisigAccountModificationType, TransactionType
from symbolchain.nem.Network import Network
from symbolchain.nem.TransactionFactory import TransactionFactory
from symbolchain.Network import NetworkLocator

from ..model.Exceptions import NodeException


class NemBlockCalculator:
	"""
	Handles NEM block size calculations and transaction building.

	Only populate variable-length fields for each descriptor, the SDK automatically fills in
	and validates the fixed-width header fields.
	"""

	def calculate_block_size(self, block_json):  # pylint: disable=too-many-locals
		"""Calculates the serialized size of a NEM block."""

		# Block structure components:
		block_type_size = 4
		version_size = 1
		reserved_padding_size = 2
		network_size = 1
		timestamp_size = 4
		signer_key_size_field = 4
		signer_public_key_size = 32
		signature_size_field = 4
		signature_size = 64
		previous_block_hash_outer_size = 4
		previous_block_hash_size = 4
		previous_block_hash_value = 32
		height_size = 8
		transaction_count_size = 4

		block_size = sum([
			block_type_size,
			version_size,
			reserved_padding_size,
			network_size,
			timestamp_size,
			signer_key_size_field,
			signer_public_key_size,
			signature_size_field,
			signature_size,
			previous_block_hash_outer_size,
			previous_block_hash_size,
			previous_block_hash_value,
			height_size,
			transaction_count_size
		])

		transactions_size = sum(
			self.calculate_transaction_size(tx_entry['tx'])
			for tx_entry in block_json.get('txes', [])
		)

		return block_size + transactions_size

	def calculate_transaction_size(self, tx_json):
		"""Calculates the serialized size of a transaction."""

		try:
			transaction = self.build_transaction(tx_json)
			return transaction.size
		except Exception as exc:
			raise NodeException(f'Failed to calculate transaction size for type {tx_json.get("type", "unknown")}: {exc}') from exc

	def build_transaction(self, tx_json):
		"""Builds a transaction object from JSON data."""

		network_id = (tx_json['version'] >> 24) & 0xFF
		network = NetworkLocator.find_by_identifier(Network.NETWORKS, network_id)

		facade = NemFacade(network)

		transaction_descriptor = self._build_transaction_descriptor(tx_json)

		return facade.transaction_factory.create(transaction_descriptor)

	def _build_transaction_descriptor(self, tx_json):
		"""Builds a transaction descriptor suitable for the facade factory."""

		transaction_builders = {
			TransactionType.TRANSFER.value: self._build_transfer_transaction,
			TransactionType.ACCOUNT_KEY_LINK.value: self._build_account_key_link_transaction,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: self._build_multisig_account_modification_transaction,
			TransactionType.NAMESPACE_REGISTRATION.value: self._build_namespace_registration_transaction,
			TransactionType.MOSAIC_DEFINITION.value: self._build_mosaic_definition_transaction,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: self._build_mosaic_supply_change_transaction,
			TransactionType.MULTISIG.value: self._build_multisig_transaction,
			TransactionType.MULTISIG_COSIGNATURE.value: self._build_cosignature_transaction
		}

		builder_method = transaction_builders.get(tx_json['type'])

		if not builder_method:
			raise NodeException(f'Unsupported transaction type {tx_json.get("type", "unknown")}')

		return builder_method(tx_json)

	def _lookup_transaction_name(self, tx_type_value, schema_version):  # pylint: disable=no-self-use
		"""Resolves transaction names expected by the SDK factory."""

		tx_type = TransactionType(tx_type_value)
		transaction_name = TransactionFactory.lookup_transaction_name(tx_type, schema_version)

		return transaction_name

	def _build_transfer_transaction(self, tx_json):
		"""Builds a transfer transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
		}

		message_json = tx_json.get('message')
		if message_json and message_json.get('payload'):
			transaction['message'] = {
				'message': unhexlify(message_json['payload'])
			}

		mosaics = tx_json.get('mosaics')
		if mosaics:
			transaction['mosaics'] = [
				{
					'mosaic': {
						'mosaic_id': {
							'namespace_id': {'name': mosaic_json['mosaicId']['namespaceId']},
							'name': mosaic_json['mosaicId']['name']
						}
					}
				} for mosaic_json in mosaics
			]

		return transaction

	def _build_account_key_link_transaction(self, tx_json):
		"""Builds an account key link transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
		}

		return transaction

	def _build_multisig_account_modification_transaction(self, tx_json):
		"""Builds a multisig account modification transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
			'modifications': [
				{
					'modification': {
						'modification_type': MultisigAccountModificationType(modification['modificationType']).name.lower(),
						'cosignatory_public_key': modification['cosignatoryAccount']
					}
				} for modification in tx_json.get('modifications', [])
			]
		}

		if schema_version == 2:
			transaction['min_approval_delta'] = tx_json['minCosignatories']['relativeChange']

		return transaction

	def _build_namespace_registration_transaction(self, tx_json):
		"""Builds a namespace registration transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
			'name': tx_json['newPart']
		}

		if 'parent' in tx_json:
			transaction['parent_name'] = tx_json['parent']

		return transaction

	def _build_mosaic_definition_transaction(self, tx_json):
		"""Builds a mosaic definition transaction."""

		schema_version = tx_json['version'] & 0xFF
		mosaic_definition = tx_json['mosaicDefinition']

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
			'mosaic_definition': {
				'id': {
					'namespace_id': {'name': mosaic_definition['id']['namespaceId'].encode('utf8')},
					'name': mosaic_definition['id']['name'].encode('utf8')
				},
				'description': mosaic_definition['description'].encode('utf8'),
				'properties': [
					{
						'property_': {
							'name': prop['name'].encode('utf8'),
							'value': prop['value'].encode('utf8')
						},
					} for prop in mosaic_definition['properties']
				]
			}
		}

		levy = mosaic_definition.get('levy')
		if levy:
			transaction['mosaic_definition']['levy'] = {
				'mosaic_id': {
					'namespace_id': {'name': levy['mosaicId']['namespaceId'].encode('utf8')},
					'name': levy['mosaicId']['name'].encode('utf8')
				},
			}

		return transaction

	def _build_mosaic_supply_change_transaction(self, tx_json):
		"""Builds a mosaic supply change transaction."""

		schema_version = tx_json['version'] & 0xFF

		mosaic_id = tx_json['mosaicId']

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
			'mosaic_id': {
				'namespace_id': {'name': mosaic_id['namespaceId'].encode('utf8')},
				'name': mosaic_id['name'].encode('utf8')
			},
		}

		return transaction

	def _build_cosignature_transaction(self, tx_json):  # pylint: disable=no-self-use
		"""Builds a cosignature transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': f'cosignature_v{schema_version}',
		}

		return transaction

	def _build_multisig_transaction(self, tx_json):
		"""Builds a multisig transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': self._lookup_transaction_name(tx_json['type'], schema_version),
			'inner_transaction': TransactionFactory.to_non_verifiable_transaction(
				self.build_transaction(tx_json['otherTrans'])
			),
			'cosignatures': []
		}

		for sig_json in tx_json.get('signatures', []):
			cosignature_descriptor = dict(self._build_transaction_descriptor(sig_json))
			cosignature_descriptor.pop('type', None)
			transaction['cosignatures'].append({'cosignature': cosignature_descriptor})

		return transaction
