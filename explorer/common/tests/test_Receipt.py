import pytest
from common.symbol.Receipt import (
	ARTIFACT_EXPIRY_RECEIPT_TYPES,
	BALANCE_CHANGE_RECEIPT_TYPES,
	BALANCE_TRANSFER_RECEIPT_TYPES,
	INFLATION_RECEIPT_TYPE,
	MOSAIC_EXPIRED_RECEIPT_TYPE,
	NAMESPACE_DELETED_RECEIPT_TYPE,
	NAMESPACE_EXPIRED_RECEIPT_TYPE,
	RECEIPT_GROUP_VALUES,
	RECEIPT_TYPE_CODES,
	RECEIPT_TYPE_GROUPS,
	RECEIPT_TYPE_LABELS,
	RECEIPT_TYPE_VALUES
)
from symbolchain.sc import ReceiptType


def test_receipt_contract_has_labels():
	# Arrange:
	expected_labels = {
		4685: 'mosaicRentalFee',
		4942: 'namespaceRentalFee',
		8515: 'harvestFee',
		8776: 'lockHashCompleted',
		9032: 'lockHashExpired',
		8786: 'lockSecretCompleted',
		9042: 'lockSecretExpired',
		12616: 'lockHashCreated',
		12626: 'lockSecretCreated',
		16717: 'mosaicExpired',
		16718: 'namespaceExpired',
		16974: 'namespaceDeleted',
		20803: 'inflation'
	}

	# Act / Assert:
	assert tuple(expected_labels) == RECEIPT_TYPE_CODES
	assert expected_labels == RECEIPT_TYPE_LABELS
	assert tuple(expected_labels.values()) == RECEIPT_TYPE_VALUES


def test_receipt_contract_has_groups():
	# Arrange:
	expected_groups = {
		4685: 'balanceTransfer',
		4942: 'balanceTransfer',
		8515: 'balanceChange',
		8776: 'balanceChange',
		9032: 'balanceChange',
		8786: 'balanceChange',
		9042: 'balanceChange',
		12616: 'balanceChange',
		12626: 'balanceChange',
		16717: 'artifactExpiry',
		16718: 'artifactExpiry',
		16974: 'artifactExpiry',
		20803: 'inflation'
	}

	# Act / Assert:
	assert expected_groups == RECEIPT_TYPE_GROUPS
	assert set(RECEIPT_TYPE_LABELS) == set(RECEIPT_TYPE_GROUPS)
	assert ('balanceChange', 'balanceTransfer', 'artifactExpiry', 'inflation') == RECEIPT_GROUP_VALUES


def test_contract_uses_sdk_codes():
	# Arrange / Act:
	expected_codes = tuple(receipt_type.value for receipt_type in (
		ReceiptType.MOSAIC_RENTAL_FEE,
		ReceiptType.NAMESPACE_RENTAL_FEE,
		ReceiptType.HARVEST_FEE,
		ReceiptType.LOCK_HASH_COMPLETED,
		ReceiptType.LOCK_HASH_EXPIRED,
		ReceiptType.LOCK_SECRET_COMPLETED,
		ReceiptType.LOCK_SECRET_EXPIRED,
		ReceiptType.LOCK_HASH_CREATED,
		ReceiptType.LOCK_SECRET_CREATED,
		ReceiptType.MOSAIC_EXPIRED,
		ReceiptType.NAMESPACE_EXPIRED,
		ReceiptType.NAMESPACE_DELETED,
		ReceiptType.INFLATION
	))

	# Assert:
	assert expected_codes == RECEIPT_TYPE_CODES
	assert {receipt_type.value for receipt_type in BALANCE_CHANGE_RECEIPT_TYPES} == {
		ReceiptType.HARVEST_FEE.value,
		ReceiptType.LOCK_HASH_CREATED.value,
		ReceiptType.LOCK_HASH_COMPLETED.value,
		ReceiptType.LOCK_HASH_EXPIRED.value,
		ReceiptType.LOCK_SECRET_CREATED.value,
		ReceiptType.LOCK_SECRET_COMPLETED.value,
		ReceiptType.LOCK_SECRET_EXPIRED.value
	}
	assert {receipt_type.value for receipt_type in BALANCE_TRANSFER_RECEIPT_TYPES} == {
		ReceiptType.MOSAIC_RENTAL_FEE.value,
		ReceiptType.NAMESPACE_RENTAL_FEE.value
	}
	assert {receipt_type.value for receipt_type in ARTIFACT_EXPIRY_RECEIPT_TYPES} == {
		ReceiptType.MOSAIC_EXPIRED.value,
		ReceiptType.NAMESPACE_EXPIRED.value,
		ReceiptType.NAMESPACE_DELETED.value
	}


def test_receipt_has_derived_labels():
	# Arrange / Act / Assert:
	assert 'inflation' == INFLATION_RECEIPT_TYPE
	assert 'mosaicExpired' == MOSAIC_EXPIRED_RECEIPT_TYPE
	assert 'namespaceExpired' == NAMESPACE_EXPIRED_RECEIPT_TYPE
	assert 'namespaceDeleted' == NAMESPACE_DELETED_RECEIPT_TYPE


def test_receipt_maps_are_immutable():
	# Arrange / Act / Assert:
	with pytest.raises(TypeError):
		RECEIPT_TYPE_LABELS[8515] = 'changed'

	with pytest.raises(TypeError):
		RECEIPT_TYPE_GROUPS[8515] = 'changed'
