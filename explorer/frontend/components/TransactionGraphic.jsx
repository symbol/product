import ValueCopy from './ValueCopy';
import ValueList from './ValueList';
import CustomImage from '@/components/CustomImage';
import Field from '@/components/Field';
import Separator from '@/components/Separator';
import ValueAccount from '@/components/ValueAccount';
import ValueMosaic from '@/components/ValueMosaic';
import ValueNamespace from '@/components/ValueNamespace';
import ValueTransactionAliasAction from '@/components/ValueTransactionAliasAction';
import ValueTransactionMessage from '@/components/ValueTransactionMessage';
import ValueTransactionType from '@/components/ValueTransactionType';
import { KEY_LINK_ACTION, SUPPLY_CHANGE_ACTION, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/TransactionGraphic.module.scss';
import { useTranslation } from 'next-i18next';

const KEY_LINK_RECIPIENT_TYPES = [
	TRANSACTION_TYPE.ACCOUNT_KEY_LINK,
	TRANSACTION_TYPE.NODE_KEY_LINK,
	TRANSACTION_TYPE.VOTING_KEY_LINK,
	TRANSACTION_TYPE.VRF_KEY_LINK
];
const RECIPIENT_TYPES = [
	TRANSACTION_TYPE.SECRET_LOCK,
	TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION
];
export const TRANSACTION_GRAPHIC_DETAIL_FIELD_MAP = {
	type: ['transactionType'],
	recipient: ['recipient'],
	address: ['address'],
	targetAccount: ['linkedAccountAddress', 'targetAddress'],
	targetMosaic: ['mosaicId', 'targetMosaicId', 'referenceMosaicId'],
	targetNamespace: ['namespaceId', 'namespaceName', 'targetNamespaceId'],
	registrationType: ['registrationType'],
	parentId: ['parentId'],
	mosaics: ['mosaics'],
	message: ['message'],
	minApprovalDelta: ['minApprovalDelta'],
	minRemovalDelta: ['minRemovalDelta'],
	minCosignatories: ['minApprovalDelta'],
	cosignatoryAdditions: ['addressAdditions'],
	cosignatoryDeletions: ['addressDeletions'],
	restrictionType: ['restrictionType'],
	restrictionAddressAdditions: ['restrictionAddressAdditions'],
	restrictionAddressDeletions: ['restrictionAddressDeletions'],
	restrictionMosaicAdditions: ['restrictionMosaicAdditions'],
	restrictionMosaicDeletions: ['restrictionMosaicDeletions'],
	restrictionOperationAdditions: ['restrictionOperationAdditions'],
	restrictionOperationDeletions: ['restrictionOperationDeletions'],
	divisibility: ['divisibility'],
	duration: ['duration'],
	nonce: ['nonce'],
	supplyMutable: ['supplyMutable'],
	transferable: ['transferable'],
	restrictable: ['restrictable'],
	revokable: ['revokable'],
	hash: ['hash'],
	hashAlgorithm: ['hashAlgorithm'],
	secret: ['secret'],
	proof: ['proof'],
	delta: ['delta'],
	supplyAction: ['action'],
	aliasAction: ['aliasAction'],
	namespaceId: ['namespaceId'],
	namespaceName: ['namespaceName'],
	targetMosaicAliasNames: ['targetMosaicAliasNames'],
	referenceMosaicId: ['referenceMosaicId'],
	mosaicAliasNames: ['mosaicAliasNames'],
	targetAddress: ['targetAddress'],
	restrictionKey: ['restrictionKey'],
	previousRestrictionType: ['previousRestrictionType'],
	previousRestrictionValue: ['previousRestrictionValue'],
	newRestrictionType: ['newRestrictionType'],
	newRestrictionValue: ['newRestrictionValue'],
	keyLinkAction: ['linkAction'],
	publicKey: ['linkedPublicKey'],
	startEpoch: ['startEpoch'],
	endEpoch: ['endEpoch'],
	scopedMetadataKey: ['scopedMetadataKey'],
	valueDelta: ['valueDelta'],
	valueSizeDelta: ['valueSizeDelta']
};

const formatAliasNames = aliasNames => {
	if (Array.isArray(aliasNames))
		return aliasNames.length ? aliasNames.join(', ') : 'N/A';

	return aliasNames || 'N/A';
};

const renderTransactionMessage = message =>
	message?.type === 'plain' ? message.text : <ValueTransactionMessage message={message} />;

const hasGraphicValue = value => {
	if (Array.isArray(value))
		return !!value.length;

	return value !== null && value !== undefined && value !== '';
};

export const getTransactionGraphicDetailFieldKeys = transaction => {
	const fields = new Set();

	Object.entries(TRANSACTION_GRAPHIC_DETAIL_FIELD_MAP).forEach(([graphicKey, detailKeys]) => {
		if (hasGraphicValue(transaction[graphicKey]))
			detailKeys.forEach(key => fields.add(key));
	});
	if (KEY_LINK_RECIPIENT_TYPES.includes(transaction.type) && hasGraphicValue(transaction.targetAccount))
		fields.add('address');
	if (transaction.type === TRANSACTION_TYPE.ADDRESS_ALIAS && hasGraphicValue(transaction.recipient))
		fields.add('address');
	if (transaction.type === TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION) {
		fields.add('restrictionType');
		fields.add('restrictionAddressAdditions');
		fields.add('restrictionAddressDeletions');
	}
	if (transaction.type === TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION) {
		fields.add('restrictionType');
		fields.add('restrictionMosaicAdditions');
		fields.add('restrictionMosaicDeletions');
	}
	if (transaction.type === TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION) {
		fields.add('restrictionType');
		fields.add('restrictionOperationAdditions');
		fields.add('restrictionOperationDeletions');
	}
	if (transaction.type === TRANSACTION_TYPE.MOSAIC_METADATA)
		fields.add('targetMosaicAliasNames');

	return [...fields];
};

const TransactionGraphic = ({ transactions }) => {
	const { t } = useTranslation();

	const getTargetText = transactionType => {
		if (KEY_LINK_RECIPIENT_TYPES.includes(transactionType))
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.ADDRESS_ALIAS)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.MOSAIC_ALIAS)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.MOSAIC_METADATA)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.NAMESPACE_METADATA)
			return t('field_target');

		if (transactionType === TRANSACTION_TYPE.ACCOUNT_METADATA)
			return t('field_targetAddress');

		if (transactionType === TRANSACTION_TYPE.HASH_LOCK)
			return t('field_duration');

		if (RECIPIENT_TYPES.includes(transactionType))
			return t('field_recipient');

		switch (transactionType) {
		case TRANSACTION_TYPE.TRANSFER:
			return t('field_recipient');
		case TRANSACTION_TYPE.MOSAIC_CREATION:
		case TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
			return t('field_sink');
		case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
			return t('field_targetMosaic');
		case TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
		case TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION:
		case TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION:
		case TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION:
			return t('field_targetAccount');
		}
	};

	return (
		<div className={styles.transactionGraphic}>
			{transactions.map((item, index) => (
				<div className={`layout-flex-row-mobile-col ${styles.container}`} key={index}>
					<div className={styles.graphic}>
						<div className={styles.titleRow}>
							<div>{t('field_sender')}</div>
							<div>{getTargetText(item.type)}</div>
						</div>
						<ValueAccount
							className={styles.accountLeft}
							address={item.sender}
							size="md"
							position="left"
							raw
							isAddressTruncated={false}
						/>
						<CustomImage src="/images/transaction-arrow.svg" className={styles.arrow} alt="Transaction direction" />
						<ValueTransactionType hideIcon className={styles.transactionType} value={item.type} />
						{!!item.recipient && (
							<ValueAccount
								className={styles.accountRight}
								address={item.recipient}
								size="md"
								position="right"
								raw
								isAddressTruncated={false}
							/>
						)}
						{!!item.targetAccount && (
							<ValueAccount
								className={styles.accountRight}
								address={item.targetAccount}
								size="md"
								position="right"
								raw
								isAddressTruncated={false}
							/>
						)}
						{item.type === TRANSACTION_TYPE.ACCOUNT_METADATA && !!item.targetAddress && (
							<ValueAccount
								className={styles.accountRight}
								address={item.targetAddress}
								size="md"
								position="right"
								raw
								isAddressTruncated={false}
							/>
						)}
						{!!item.targetMosaic && (
							<ValueMosaic
								className={styles.accountRight}
								mosaicId={item.targetMosaic.id}
								mosaicName={item.targetMosaic.name}
								size="md"
								position="right"
							/>
						)}
						{!!item.targetNamespace && (
							<ValueNamespace
								className={styles.accountRight}
								namespaceId={item.targetNamespace.id}
								namespaceName={item.targetNamespace.name}
								size="md"
								position="right"
							/>
						)}
						{item.type === TRANSACTION_TYPE.HASH_LOCK && item.lockDuration !== undefined && (
							<div className={styles.lockDuration}>
								<CustomImage src="/images/transaction/lock.svg" className={styles.lockDurationIcon} alt="Lock" />
								<span>{`${item.lockDuration} ${t('field_block')}`}</span>
							</div>
						)}
					</div>
					<Separator />
					<div className={`layout-flex-col-fields ${styles.info}`}>
						{item.type === TRANSACTION_TYPE.NAMESPACE_METADATA && !!item.namespaceName && (
							<Field title={t('field_namespaceName')}>{item.namespaceName}</Field>
						)}
						{item.type === TRANSACTION_TYPE.MOSAIC_METADATA && (
							<Field title={t('field_namespaceName')}>
								{formatAliasNames(item.targetMosaicAliasNames)}
							</Field>
						)}

						{/* Transfer */}
						{!!item.mosaics && (
							<Field title={t('field_mosaics')}>
								<ValueList
									data={item.mosaics}
									max={5}
									direction="column"
									title={t('field_mosaics')}
									renderItem={item => (
										<ValueMosaic mosaicId={item.id} mosaicName={item.name} amount={item.amount} isTickerShown />
									)}
								/>
							</Field>
						)}
						{!!item.message && <Field title={t('field_message')}>{renderTransactionMessage(item.message)}</Field>}

						{/* Secret Proof */}
						{!!item.hashAlgorithm && (
							<Field title={t('field_hashAlgorithm')}>{t(`secretLockHashAlgorithm_${item.hashAlgorithm}`)}</Field>
						)}
						{!!item.secret && (
							<Field title={t('field_secret')}>
								<ValueCopy value={item.secret} />
							</Field>
						)}
						{!!item.proof && (
							<Field title={t('field_proof')}>
								<ValueCopy value={item.proof} />
							</Field>
						)}

						{/* Mosaic Definition */}
						{!!item.mosaic && (
							<Field title={t('field_mosaic')}>
								<ValueMosaic mosaicId={item.mosaic.id} mosaicName={item.mosaic.name} size="md" />
							</Field>
						)}
						{item.divisibility !== undefined && <Field title={t('field_divisibility')}>{item.divisibility}</Field>}
						{![
							TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
							TRANSACTION_TYPE.HASH_LOCK
						].includes(item.type) && item.duration !== undefined && (
							<Field title={t('field_duration')}>{item.duration}</Field>
						)}
						{!!item.hash && (
							<Field title={t('field_hash')}>
								<ValueCopy value={item.hash} />
							</Field>
						)}
						{item.nonce !== undefined && <Field title={t('field_nonce')}>{`${item.nonce}`}</Field>}
						{item.supplyMutable !== undefined && (
							<Field title={t('field_supplyMutable')}>{`${item.supplyMutable}`}</Field>
						)}
						{item.transferable !== undefined && (
							<Field title={t('field_transferable')}>{`${item.transferable}`}</Field>
						)}
						{item.restrictable !== undefined && (
							<Field title={t('field_restrictable')}>{`${item.restrictable}`}</Field>
						)}
						{item.revokable !== undefined && (
							<Field title={t('field_revokable')}>{`${item.revokable}`}</Field>
						)}

						{/* Mosaic Supply Change */}
						{!!item.delta && (
							<Field title={t('field_delta')}>
								{item.supplyAction === SUPPLY_CHANGE_ACTION.INCREASE && `+${item.delta}`}
								{item.supplyAction === SUPPLY_CHANGE_ACTION.DECREASE && `-${item.delta}`}
							</Field>
						)}
						{!!item.supplyAction && (
							<Field title={t('field_supplyAction')}>
								{item.supplyAction === SUPPLY_CHANGE_ACTION.INCREASE && t('value_supplyIncrease')}
								{item.supplyAction === SUPPLY_CHANGE_ACTION.DECREASE && t('value_supplyDecrease')}
							</Field>
						)}

						{/* NS Registration */}
						{!!item.registrationType && <Field title={t('field_registrationType')}>{item.registrationType}</Field>}
						{!!item.parentId && (
							<Field title={t('field_parentId')}>
								<ValueNamespace namespaceId={item.parentId} namespaceName={item.parentId} size="md" />
							</Field>
						)}
						{!!item.aliasAction && (
							<Field title={t('field_aliasAction')}>
								<ValueTransactionAliasAction action={item.aliasAction} />
							</Field>
						)}
						{!!item.namespaceId && (
							<Field title={t('field_namespaceId')}>
								<ValueNamespace namespaceId={item.namespaceId} namespaceName={item.namespaceId} size="md" />
							</Field>
						)}
						{!!item.namespaceName && item.type !== TRANSACTION_TYPE.NAMESPACE_METADATA && (
							<Field title={t('field_name')}>{item.namespaceName}</Field>
						)}
						{item.type === TRANSACTION_TYPE.NAMESPACE_REGISTRATION && item.duration !== undefined && (
							<Field title={t('field_duration')}>{item.duration}</Field>
						)}
						{item.type === TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION && !!item.targetMosaic && (
							<Field title={t('field_mosaicId')}>
								<ValueMosaic mosaicId={item.targetMosaic.id} mosaicName={item.targetMosaic.name} />
							</Field>
						)}
						{item.type === TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION && (
							<Field title={t('table_field_alias')}>
								{formatAliasNames(item.mosaicAliasNames)}
							</Field>
						)}
						{item.type === TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION && !!item.targetAddress && (
							<Field title={t('field_targetAddress')}>
								<ValueAccount address={item.targetAddress} size="sm" raw isAddressTruncated={false} />
							</Field>
						)}
						{!!item.namespace && (
							<Field title={t('field_namespace')}>
								<ValueNamespace namespaceId={item.namespace.id} namespaceName={item.namespace.name} size="md" />
							</Field>
						)}
						{!!item.rentalFee && (
							<Field title={t('field_rentalFee')}>
								<ValueMosaic isNative amount={item.rentalFee} />
							</Field>
						)}

						{/* Multisig Account Modification */}
						{item.minApprovalDelta !== undefined && (
							<Field title={t('field_minApprovalDelta')}>{item.minApprovalDelta}</Field>
						)}
						{item.minRemovalDelta !== undefined && (
							<Field title={t('field_minRemovalDelta')}>{item.minRemovalDelta}</Field>
						)}
						{!!item.minCosignatories && <Field title={t('field_minCosignatories')}>{item.minCosignatories}</Field>}
						{!!item.cosignatoryAdditions?.length && (
							<Field title={t('field_cosignatoryAdditions')}>
								{item.cosignatoryAdditions.map((item, index) => (
									<ValueAccount address={item} key={'add' + index} />
								))}
							</Field>
						)}
						{!!item.cosignatoryDeletions?.length && (
							<Field title={t('field_cosignatoryDeletions')}>
								{item.cosignatoryDeletions.map((item, index) => (
									<ValueAccount address={item} key={'del' + index} />
								))}
							</Field>
						)}

						{/* Account Address Restriction */}
						{!!item.restrictionType && (
							<Field title={t('field_restrictionType')}>
								<div className="layout-flex-col-fields">
									<div>{item.restrictionType}</div>
									{!!item.restrictionAddressAdditions?.length && (
										<Field title={t('field_restrictionAddressAdditions')}>
											{item.restrictionAddressAdditions.map((item, index) => (
												<ValueAccount
													address={item}
													key={'restriction-add' + index}
													raw
													isAddressTruncated={false}
												/>
											))}
										</Field>
									)}
									{!!item.restrictionAddressDeletions?.length && (
										<Field title={t('field_restrictionAddressDeletions')}>
											{item.restrictionAddressDeletions.map((item, index) => (
												<ValueAccount
													address={item}
													key={'restriction-del' + index}
													raw
													isAddressTruncated={false}
												/>
											))}
										</Field>
									)}
									{!!item.restrictionMosaicAdditions?.length && (
										<Field title={t('field_restrictionMosaicAdditions')}>
											{item.restrictionMosaicAdditions.map((item, index) => (
												<ValueMosaic mosaicId={item} mosaicName={item} key={'restriction-mosaic-add' + index} />
											))}
										</Field>
									)}
									{!!item.restrictionMosaicDeletions?.length && (
										<Field title={t('field_restrictionMosaicDeletions')}>
											{item.restrictionMosaicDeletions.map((item, index) => (
												<ValueMosaic mosaicId={item} mosaicName={item} key={'restriction-mosaic-del' + index} />
											))}
										</Field>
									)}
									{!!item.restrictionOperationAdditions?.length && (
										<Field title={t('field_restrictionOperationAdditions')}>
											{item.restrictionOperationAdditions.map((item, index) => (
												<ValueTransactionType value={item} key={'restriction-operation-add' + index} />
											))}
										</Field>
									)}
									{!!item.restrictionOperationDeletions?.length && (
										<Field title={t('field_restrictionOperationDeletions')}>
											{item.restrictionOperationDeletions.map((item, index) => (
												<ValueTransactionType value={item} key={'restriction-operation-del' + index} />
											))}
										</Field>
									)}
								</div>
							</Field>
						)}

						{/* Account Key Link */}
						{!!item.keyLinkAction && (
							<Field title={t('field_keyLinkAction')}>
								{item.keyLinkAction === KEY_LINK_ACTION.LINK && t('value_keyLink')}
								{item.keyLinkAction === KEY_LINK_ACTION.UNLINK && t('value_keyUnlink')}
							</Field>
						)}
						{!!item.publicKey && (
							<Field title={t('field_publicKey')}>
								<ValueCopy value={item.publicKey} />
							</Field>
						)}
						{item.startEpoch !== undefined && <Field title={t('field_startEpoch')}>{item.startEpoch}</Field>}
						{item.endEpoch !== undefined && <Field title={t('field_endEpoch')}>{item.endEpoch}</Field>}
						{!!item.scopedMetadataKey && (
							<Field title={t('field_scopedMetadataKey')}>
								<ValueCopy value={item.scopedMetadataKey} />
							</Field>
						)}
						{item.valueDelta !== undefined && (
							<Field title={t('field_valueDelta')}>
								<ValueCopy value={item.valueDelta} />
							</Field>
						)}
						{item.valueSizeDelta !== undefined && (
							<Field title={t('field_valueSizeDelta')}>{item.valueSizeDelta}</Field>
						)}
						{!!item.referenceMosaicId && (
							<Field title={t('field_referenceMosaicId')}>
								<ValueMosaic mosaicId={item.referenceMosaicId} mosaicName={item.referenceMosaicId} />
							</Field>
						)}
						{item.type === TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION && (
							<Field title={t('table_field_alias')}>
								{formatAliasNames(item.mosaicAliasNames)}
							</Field>
						)}
						{!!item.restrictionKey && <Field title={t('field_restrictionKey')}>{item.restrictionKey}</Field>}
						{!!item.previousRestrictionType && (
							<Field title={t('field_previousRestrictionType')}>{item.previousRestrictionType}</Field>
						)}
						{item.previousRestrictionValue !== undefined && (
							<Field title={t('field_previousRestrictionValue')}>{item.previousRestrictionValue}</Field>
						)}
						{!!item.newRestrictionType && <Field title={t('field_newRestrictionType')}>{item.newRestrictionType}</Field>}
						{item.newRestrictionValue !== undefined && (
							<Field title={t('field_newRestrictionValue')}>{item.newRestrictionValue}</Field>
						)}
					</div>
				</div>
			))}
		</div>
	);
};

export default TransactionGraphic;
