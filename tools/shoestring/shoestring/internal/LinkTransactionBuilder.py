from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import Amount

COSIGNATURE_SIZE = 104


class LinkTransactionBuilder:
	"""Builder for creating an aggregate transaction containing account key link and unlink transactions."""

	def __init__(self, signer_public_key, network):
		"""Creates a builder."""

		self.signer_public_key = signer_public_key
		self.facade = SymbolFacade(network)

		self._transactions = []

	def _prepare_link_transaction(self, name, linked_public_key, link_action='link', epoch_range=None):
		transaction_descriptor = {
			'type': f'{name}_key_link_transaction_v1',
			'signer_public_key': self.signer_public_key,

			'linked_public_key': linked_public_key,
			'link_action': link_action,
		}

		if epoch_range:
			transaction_descriptor['start_epoch'] = epoch_range[0]
			transaction_descriptor['end_epoch'] = epoch_range[1]

		return self.facade.transaction_factory.create_embedded(transaction_descriptor)

	def link_account_public_key(self, linked_public_key):
		"""Links an account public key."""

		self._transactions.append(self._prepare_link_transaction('account', linked_public_key))

	def unlink_account_public_key(self, linked_public_key):
		"""Unlinks an account public key."""

		self._transactions.append(self._prepare_link_transaction('account', linked_public_key, 'unlink'))

	def link_vrf_public_key(self, vrf_public_key):
		"""Links a vrf public key."""

		self._transactions.append(self._prepare_link_transaction('vrf', vrf_public_key))

	def unlink_vrf_public_key(self, vrf_public_key):
		"""Unlinks a vrf public key."""

		self._transactions.append(self._prepare_link_transaction('vrf', vrf_public_key, 'unlink'))

	def link_voting_public_key(self, root_voting_public_key, start_epoch, end_epoch):
		"""Links a root voting public key."""

		self._transactions.append(self._prepare_link_transaction('voting', root_voting_public_key, 'link', (start_epoch, end_epoch)))

	def unlink_voting_public_key(self, root_voting_public_key, start_epoch, end_epoch):
		"""Unlinks a root voting public key."""

		self._transactions.append(self._prepare_link_transaction('voting', root_voting_public_key, 'unlink', (start_epoch, end_epoch)))

	def build(self, deadline, fee_multiplier, min_cosignatures_count):
		"""Creates the configured aggregate transaction."""

		aggregate_type = 'complete' if min_cosignatures_count <= 1 else 'bonded'

		aggregate_transaction = self.facade.transaction_factory.create({
			'type': f'aggregate_{aggregate_type}_transaction_v2',
			'signer_public_key': self.signer_public_key,  # if this is a multisig account, this will be updated during signing
			'fee': 0,
			'deadline': deadline.timestamp,
			'transactions_hash': self.facade.hash_embedded_transactions(self._transactions),
			'transactions': self._transactions
		})

		size = aggregate_transaction.size
		if min_cosignatures_count > 1:
			size += COSIGNATURE_SIZE * (min_cosignatures_count - 1)

		aggregate_transaction.fee = Amount(fee_multiplier * size)
		return aggregate_transaction, self.facade.hash_transaction(aggregate_transaction)
