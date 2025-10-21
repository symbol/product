from binascii import unhexlify

from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import MultisigAccountModificationType, TransactionType
from symbolchain.nem.Network import Network
from symbolchain.nem.TransactionFactory import TransactionFactory
from symbolchain.Network import NetworkLocator

from ..model.Exceptions import NodeException


class NemBlockCalculator:
	"""Handles NEM block size calculations and transaction building."""

	# Transaction type to builder method mapping
	TRANSACTION_BUILDERS = {
		TransactionType.TRANSFER.value: '_build_transfer_transaction',
		TransactionType.ACCOUNT_KEY_LINK.value: '_build_account_key_link_transaction',
		TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: '_build_multisig_account_modification_transaction',
		TransactionType.NAMESPACE_REGISTRATION.value: '_build_namespace_registration_transaction',
		TransactionType.MOSAIC_DEFINITION.value: '_build_mosaic_definition_transaction',
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: '_build_mosaic_supply_change_transaction',
		TransactionType.MULTISIG.value: '_build_multisig_transaction',
		TransactionType.MULTISIG_COSIGNATURE.value: '_build_cosignature_transaction'
	}

	@staticmethod
	def calculate_block_size(block_json):
		"""Calculates the serialized size of a NEM block."""

		# Block structure:
		# Block type (4) + Version (1) + reserved padding (2) + network (1)
		# Timestamp (4) + Signer Key size (4) + Signer public key (32)
		# Signature size (4) + Signature (64) + Previous block hash (40)
		# Height (8) + Transaction count (4)

		block_size = 4 + 1 + 2 + 1 + 4 + 4 + 32 + 4 + 64 + 40 + 8 + 4

		transactions_size = sum(
			NemBlockCalculator._calculate_transaction_size(tx_entry['tx'])
			for tx_entry in block_json.get('txes', [])
		)

		return block_size + transactions_size

	@staticmethod
	def _calculate_transaction_size(tx_json):
		"""Calculates the serialized size of a transaction."""

		try:
			transaction = NemBlockCalculator.build_transaction(tx_json)
			return transaction.size
		except Exception as exc:
			raise NodeException(f'Failed to calculate transaction size for type {tx_json.get("type", "unknown")}: {exc}') from exc

	@staticmethod
	def build_transaction(tx_json):  # pylint: disable=no-self-use
		"""Builds a transaction object from JSON data."""

		network_id = (tx_json['version'] >> 24) & 0xFF
		network = NetworkLocator.find_by_identifier(Network.NETWORKS, network_id)

		facade = NemFacade(network)

		transaction_descriptor = NemBlockCalculator._build_transaction_descriptor(tx_json)

		return facade.transaction_factory.create(transaction_descriptor)

	@staticmethod
	def _build_transaction_descriptor(tx_json):
		"""Builds a transaction descriptor suitable for the facade factory."""
		builder_method_name = NemBlockCalculator.TRANSACTION_BUILDERS.get(tx_json['type'])
		if not builder_method_name:
			raise NodeException(f'Unsupported transaction type {tx_json.get("type", "unknown")}')

		builder_method = getattr(NemBlockCalculator, builder_method_name)
		return builder_method(tx_json)

	@staticmethod
	def _lookup_transaction_name(tx_type_value, schema_version):
		"""Resolves transaction names expected by the SDK factory."""

		tx_type = TransactionType(tx_type_value)
		transaction_name = TransactionFactory.lookup_transaction_name(tx_type, schema_version)

		return transaction_name

	@staticmethod
	def _build_transfer_transaction(tx_json):
		"""Builds a transfer transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
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

	@staticmethod
	def _build_account_key_link_transaction(tx_json):
		"""Builds an account key link transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
		}

		return transaction

	@staticmethod
	def _build_multisig_account_modification_transaction(tx_json):
		"""Builds a multisig account modification transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
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

	@staticmethod
	def _build_namespace_registration_transaction(tx_json):
		"""Builds a namespace registration transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
			'name': tx_json['newPart']
		}

		if 'parent' in tx_json:
			transaction['parent_name'] = tx_json['parent']

		return transaction

	@staticmethod
	def _build_mosaic_definition_transaction(tx_json):
		"""Builds a mosaic definition transaction."""

		schema_version = tx_json['version'] & 0xFF
		mosaic_definition = tx_json['mosaicDefinition']

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
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

	@staticmethod
	def _build_mosaic_supply_change_transaction(tx_json):
		"""Builds a mosaic supply change transaction."""

		schema_version = tx_json['version'] & 0xFF

		mosaic_id = tx_json['mosaicId']

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
			'mosaic_id': {
				'namespace_id': {'name': mosaic_id['namespaceId'].encode('utf8')},
				'name': mosaic_id['name'].encode('utf8')
			},
		}

		return transaction

	@staticmethod
	def _build_cosignature_transaction(tx_json):
		"""Builds a cosignature transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': f'cosignature_v{schema_version}',
		}

		return transaction

	@staticmethod
	def _build_multisig_transaction(tx_json):
		"""Builds a multisig transaction."""

		schema_version = tx_json['version'] & 0xFF

		transaction = {
			'type': NemBlockCalculator._lookup_transaction_name(tx_json['type'], schema_version),
			'inner_transaction': TransactionFactory.to_non_verifiable_transaction(
				NemBlockCalculator.build_transaction(tx_json['otherTrans'])
			),
			'cosignatures': []
		}

		for sig_json in tx_json.get('signatures', []):
			cosignature_descriptor = dict(NemBlockCalculator._build_transaction_descriptor(sig_json))
			cosignature_descriptor.pop('type', None)
			transaction['cosignatures'].append({'cosignature': cosignature_descriptor})

		return transaction
