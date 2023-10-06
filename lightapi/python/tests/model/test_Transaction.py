import unittest

from symbolchain.nc import TransactionType

from symbollightapi.model.Transaction import (
	AccountKeyLinkTransaction,
	CosignSignatureTransaction,
	Message,
	Modification,
	Mosaic,
	MosaicDefinitionTransaction,
	MosaicLevy,
	MosaicProperties,
	MosaicSupplyChangeTransaction,
	MultisigAccountModificationTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	TransactionFactory,
	TransferTransaction
)

COMMON_ARGS = {
	'transaction_hash': '306f20260a1b7af692834809d3e7d53edd41616d5076ac0fac6cfa75982185df',
	'height': 10,
	'sender': '22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
	'fee': 8000000,
	'timestamp': 73397,
	'deadline': 83397,
	'signature':
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e',
}

TRANSFER_TRANSACTION_ARGS = {
	'recipient': 'TCWZ6H3Y6K6G4FLH2YF2JBK2ZJU2Z4K4JZ3W5KQ',
	'amount': 1000000,
	'message': Message('test', 1),
	'mosaics': [Mosaic('nem.xem', 1000000)]
}

ACCOUNT_KEY_LINK_TRANSACTION_ARGS = {
	'mode': 1,
	'remote_account': '22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
}

MULTISIG_ACCOUNT_MODIFICATION_TRANSACTION_ARGS = {
	'min_cosignatories': 1,
	'modifications': [
		Modification(1, '22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d')
	]
}

MULTISIG_TRANSACTION_ARGS = {
	'signatures': [
		CosignSignatureTransaction(
			261593985,
			'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64',
			'TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU',
			'22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
			500000,
			261593985,
			'249bc2dbad96e827eabc991b59dff7f12cc27f3e0da8ab3db6a3201169431786'
			'72f712ba14ed7a3b890e161357a163e7408aa22e1d6d1382ebada57973862706'
		)
	],
	'other_transaction': TransferTransaction(
		**COMMON_ARGS,
		**TRANSFER_TRANSACTION_ARGS
	)
}

NAMESPACE_REGISTRATION_TRANSACTION_ARGS = {
	'rental_fee_sink': 'TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU',
	'rental_fee': 1000000,
	'parent': None,
	'namespace': 'test-namespace'
}

MOSAIC_DEFINITION_TRANSACTION_ARGS = {
	'creation_fee': 1000000,
	'creation_fee_sink': 'TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU',
	'creator': '595613ba7254a20f1c4c7d215103509f9f9c809de03897cff2b3527b181274e2',
	'description': 'mosaic description info',
	'namespace_name': 'test-namespace.name',
	'properties': MosaicProperties(0, 1000000, True, True),
	'levy': MosaicLevy(1, 'TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU', 1, 'nem.xem')
}

MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS = {
	'supply_type': 1,
	'delta': 1000000,
	'namespace_name': 'test-namespace.name',
}


class BaseTransactionTest(unittest.TestCase):
	TRANSACTION_CLASS = None
	TRANSACTION_ARGS = None
	INVALID_OBJECT = [
		('transaction_hash', 'hash'),
		('height', 3),
		('sender', 'sender'),
		('fee', 10000),
		('timestamp', 83977),
		('deadline', 73977),
		('signature', 'signature'),
		('transaction_type', 123),
	]

	def _create_default_transaction(self, override=None):
		transaction = self.TRANSACTION_CLASS(**COMMON_ARGS, **self.TRANSACTION_ARGS)  # pylint: disable=not-callable

		if override:
			setattr(transaction, override[0], override[1])

		return transaction

	def _test_eq_is_supported(self):
		# Arrange:
		transaction = self._create_default_transaction()

		# Act + Assert:
		self.assertEqual(transaction, self._create_default_transaction())
		self.assertNotEqual(transaction, None)
		self.assertNotEqual(transaction, 1234567)

		for attr, value in self.INVALID_OBJECT:
			self.assertNotEqual(transaction, self._create_default_transaction((attr, value)))


class TransferTransactionTest(BaseTransactionTest):
	TRANSACTION_CLASS = TransferTransaction
	TRANSACTION_ARGS = TRANSFER_TRANSACTION_ARGS
	INVALID_OBJECT = BaseTransactionTest.INVALID_OBJECT + [
		('recipient', 'recipient'),
		('amount', 1),
		('message', Message('test', 2)),
		('mosaics', [Mosaic('nem.xem', 2000000)])
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class AccountKeyLinkTransactionTest(BaseTransactionTest):
	TRANSACTION_CLASS = AccountKeyLinkTransaction
	TRANSACTION_ARGS = ACCOUNT_KEY_LINK_TRANSACTION_ARGS
	INVALID_OBJECT = [
		('transaction_hash', 'hash'),
		('height', 3),
		('sender', 'sender'),
		('fee', 10000),
		('timestamp', 83977),
		('deadline', 73977),
		('signature', 'signature'),
		('transaction_type', 123),
		('mode', 2),
		('remote_account', 'address')
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class MultisigAccountModificationTest(BaseTransactionTest):
	TRANSACTION_CLASS = MultisigAccountModificationTransaction
	TRANSACTION_ARGS = MULTISIG_ACCOUNT_MODIFICATION_TRANSACTION_ARGS
	INVALID_OBJECT = [
		('transaction_hash', 'hash'),
		('height', 3),
		('sender', 'sender'),
		('fee', 10000),
		('timestamp', 83977),
		('deadline', 73977),
		('signature', 'signature'),
		('transaction_type', 123),
		('min_cosignatories', 0),
		('modifications', [])
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class MultisigTransactionTest(BaseTransactionTest):
	TRANSACTION_CLASS = MultisigTransaction
	TRANSACTION_ARGS = MULTISIG_TRANSACTION_ARGS
	INVALID_OBJECT = BaseTransactionTest.INVALID_OBJECT + [
		('signatures', []),
		('other_transaction', 1)
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class NamespaceRegistrationTest(BaseTransactionTest):
	TRANSACTION_CLASS = NamespaceRegistrationTransaction
	TRANSACTION_ARGS = NAMESPACE_REGISTRATION_TRANSACTION_ARGS
	INVALID_OBJECT = BaseTransactionTest.INVALID_OBJECT + [
		('rental_fee_sink', 'abc'),
		('rental_fee', 2),
		('parent', 'some-parent'),
		('namespace', 'some-namespace')
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class MosaicDefinitionTest(BaseTransactionTest):
	TRANSACTION_CLASS = MosaicDefinitionTransaction
	TRANSACTION_ARGS = MOSAIC_DEFINITION_TRANSACTION_ARGS
	INVALID_OBJECT = BaseTransactionTest.INVALID_OBJECT + [
		('creation_fee', 10),
		('creation_fee_sink', 'abc'),
		('creator', 'helo'),
		('description', 'random-text'),
		('namespace_name', 'random-text'),
		('properties', None),
		('levy', None),
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class MosaicSupplyChangeTest(BaseTransactionTest):
	TRANSACTION_CLASS = MosaicSupplyChangeTransaction
	TRANSACTION_ARGS = MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS
	INVALID_OBJECT = BaseTransactionTest.INVALID_OBJECT + [
		('supply_type', 3),
		('delta', 100),
		('namespace_name', 'abc')
	]

	def test_eq_is_supported(self):
		self._test_eq_is_supported()


class CosignSignatureTransactionTest(unittest.TestCase):
	@staticmethod
	def _create_default_cosign_signature_transaction(override=None):
		cosign_signature_transaction = CosignSignatureTransaction(
			timestamp=261593985,
			other_hash='edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64',
			other_account='TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU',
			sender='22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
			fee=500000,
			deadline=261593985,
			signature=(
				'249bc2dbad96e827eabc991b59dff7f12cc27f3e0da8ab3db6a3201169431786'
				'72f712ba14ed7a3b890e161357a163e7408aa22e1d6d1382ebada57973862706'
			)
		)

		if override:
			setattr(cosign_signature_transaction, override[0], override[1])

		return cosign_signature_transaction

	def test_can_create_cosign_signature_transaction(self):
		# Act:
		cosign_signature_transaction = self._create_default_cosign_signature_transaction()

		# Assert:
		self.assertEqual(261593985, cosign_signature_transaction.timestamp)
		self.assertEqual('edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64', cosign_signature_transaction.other_hash)
		self.assertEqual('TALIC367CZIV55GIQT35HDZAZ53CN3VPB3G55BMU', cosign_signature_transaction.other_account)
		self.assertEqual('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d', cosign_signature_transaction.sender)
		self.assertEqual(500000, cosign_signature_transaction.fee)
		self.assertEqual(261593985, cosign_signature_transaction.deadline)
		self.assertEqual(
			'249bc2dbad96e827eabc991b59dff7f12cc27f3e0da8ab3db6a3201169431786'
			'72f712ba14ed7a3b890e161357a163e7408aa22e1d6d1382ebada57973862706', cosign_signature_transaction.signature)
		self.assertEqual(TransactionType.MULTISIG_COSIGNATURE.value, cosign_signature_transaction.transaction_type)


class TransactionFactoryTest(unittest.TestCase):
	def _run_common_args_test(self, transaction):
		self.assertEqual(COMMON_ARGS['transaction_hash'], transaction.transaction_hash)
		self.assertEqual(COMMON_ARGS['height'], transaction.height)
		self.assertEqual(COMMON_ARGS['sender'], transaction.sender)
		self.assertEqual(COMMON_ARGS['fee'], transaction.fee)
		self.assertEqual(COMMON_ARGS['timestamp'], transaction.timestamp)
		self.assertEqual(COMMON_ARGS['deadline'], transaction.deadline)
		self.assertEqual(COMMON_ARGS['signature'], transaction.signature)

	def test_create_transfer_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(TransactionType.TRANSFER.value, COMMON_ARGS, TRANSFER_TRANSACTION_ARGS)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(TRANSFER_TRANSACTION_ARGS['recipient'], transaction.recipient)
		self.assertEqual(TRANSFER_TRANSACTION_ARGS['amount'], transaction.amount)
		self.assertEqual(TRANSFER_TRANSACTION_ARGS['message'], transaction.message)
		self.assertEqual(TRANSFER_TRANSACTION_ARGS['mosaics'], transaction.mosaics)
		self.assertEqual(TransactionType.TRANSFER.value, transaction.transaction_type)

	def test_create_account_key_link_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(
			TransactionType.ACCOUNT_KEY_LINK.value,
			COMMON_ARGS,
			ACCOUNT_KEY_LINK_TRANSACTION_ARGS
		)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(ACCOUNT_KEY_LINK_TRANSACTION_ARGS['mode'], transaction.mode)
		self.assertEqual(ACCOUNT_KEY_LINK_TRANSACTION_ARGS['remote_account'], transaction.remote_account)
		self.assertEqual(TransactionType.ACCOUNT_KEY_LINK.value, transaction.transaction_type)

	def test_create_multisig_account_modification_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value,
			COMMON_ARGS,
			MULTISIG_ACCOUNT_MODIFICATION_TRANSACTION_ARGS
		)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(MULTISIG_ACCOUNT_MODIFICATION_TRANSACTION_ARGS['min_cosignatories'], transaction.min_cosignatories)
		self.assertEqual(MULTISIG_ACCOUNT_MODIFICATION_TRANSACTION_ARGS['modifications'], transaction.modifications)
		self.assertEqual(TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value, transaction.transaction_type)

	def test_create_multisig_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(TransactionType.MULTISIG.value, COMMON_ARGS, MULTISIG_TRANSACTION_ARGS)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(MULTISIG_TRANSACTION_ARGS['signatures'], transaction.signatures)
		self.assertEqual(MULTISIG_TRANSACTION_ARGS['other_transaction'], transaction.other_transaction)
		self.assertEqual(TransactionType.MULTISIG.value, transaction.transaction_type)

	def test_create_namespace_registration_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(
			TransactionType.NAMESPACE_REGISTRATION.value,
			COMMON_ARGS,
			NAMESPACE_REGISTRATION_TRANSACTION_ARGS
		)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(NAMESPACE_REGISTRATION_TRANSACTION_ARGS['rental_fee_sink'], transaction.rental_fee_sink)
		self.assertEqual(NAMESPACE_REGISTRATION_TRANSACTION_ARGS['rental_fee'], transaction.rental_fee)
		self.assertEqual(NAMESPACE_REGISTRATION_TRANSACTION_ARGS['parent'], transaction.parent)
		self.assertEqual(NAMESPACE_REGISTRATION_TRANSACTION_ARGS['namespace'], transaction.namespace)
		self.assertEqual(TransactionType.NAMESPACE_REGISTRATION.value, transaction.transaction_type)

	def test_create_mosaic_definition_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(
			TransactionType.MOSAIC_DEFINITION.value,
			COMMON_ARGS,
			MOSAIC_DEFINITION_TRANSACTION_ARGS
		)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['creation_fee'], transaction.creation_fee)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['creation_fee_sink'], transaction.creation_fee_sink)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['creator'], transaction.creator)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['description'], transaction.description)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['namespace_name'], transaction.namespace_name)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['properties'], transaction.properties)
		self.assertEqual(MOSAIC_DEFINITION_TRANSACTION_ARGS['levy'], transaction.levy)
		self.assertEqual(TransactionType.MOSAIC_DEFINITION.value, transaction.transaction_type)

	def test_create_mosaic_supply_change_transaction(self):
		# Arrange + Act:
		transaction = TransactionFactory.create_transaction(
			TransactionType.MOSAIC_SUPPLY_CHANGE.value,
			COMMON_ARGS,
			MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS
		)

		# Assert:
		self._run_common_args_test(transaction)
		self.assertEqual(MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS['supply_type'], transaction.supply_type)
		self.assertEqual(MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS['delta'], transaction.delta)
		self.assertEqual(MOSAIC_SUPPLY_CHANGE_TRANSACTION_ARGS['namespace_name'], transaction.namespace_name)
		self.assertEqual(TransactionType.MOSAIC_SUPPLY_CHANGE.value, transaction.transaction_type)
