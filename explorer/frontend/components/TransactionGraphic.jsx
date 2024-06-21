import ValueCopy from './ValueCopy';
import ValueList from './ValueList';
import CustomImage from '@/components/CustomImage';
import Field from '@/components/Field';
import Separator from '@/components/Separator';
import ValueAccount from '@/components/ValueAccount';
import ValueMosaic from '@/components/ValueMosaic';
import ValueNamespace from '@/components/ValueNamespace';
import ValueTransactionType from '@/components/ValueTransactionType';
import { KEY_LINK_ACTION, SUPPLY_CHANGE_ACTION, TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/TransactionGraphic.module.scss';
import { useTranslation } from 'next-i18next';

const TransactionGraphic = ({ transactions }) => {
	const { t } = useTranslation();

	const getTargetText = transactionType => {
		switch (transactionType) {
			case TRANSACTION_TYPE.TRANSFER:
				return t('field_recipient');
			case TRANSACTION_TYPE.MOSAIC_CREATION:
			case TRANSACTION_TYPE.NAMESPACE_REGISTRATION:
				return t('field_sink');
			case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE:
				return t('field_targetMosaic');
			case TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION:
			case TRANSACTION_TYPE.ACCOUNT_KEY_LINK:
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
						<ValueAccount className={styles.accountLeft} address={item.sender} size="md" position="left" />
						<CustomImage src="/images/transaction-arrow.svg" className={styles.arrow} alt="Transaction direction" />
						<ValueTransactionType hideIcon className={styles.transactionType} value={item.type} />
						{!!item.recipient && (
							<ValueAccount className={styles.accountRight} address={item.recipient} size="md" position="right" />
						)}
						{!!item.targetAccount && (
							<ValueAccount className={styles.accountRight} address={item.targetAccount} size="md" position="right" />
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
					</div>
					<Separator />
					<div className={`layout-flex-col-fields ${styles.info}`}>
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
						{!!item.message && <Field title={t('field_message')}>{item.message.text}</Field>}

						{/* Mosaic Definition */}
						{!!item.mosaic && (
							<Field title={t('field_mosaic')}>
								<ValueMosaic mosaicId={item.mosaic.id} mosaicName={item.mosaic.name} size="md" />
							</Field>
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
					</div>
				</div>
			))}
		</div>
	);
};

export default TransactionGraphic;
