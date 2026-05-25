import Avatar from './Avatar';
import CustomImage from './CustomImage';
import ValueAccount from './ValueAccount';
import ValueList from './ValueList';
import ValueMosaic from './ValueMosaic';
import ValueTimestamp from './ValueTimestamp';
import ValueTransactionAliasAction from './ValueTransactionAliasAction';
import ValueTransactionMessage from './ValueTransactionMessage';
import ValueTransactionHash from './ValueTransactionHash';
import ValueTransactionNamespaceRegistration from './ValueTransactionNamespaceRegistration';
import ValueTransactionProof from './ValueTransactionProof';
import ValueTransactionRestrictionAction from './ValueTransactionRestrictionAction';
import ValueTransactionSupplyAction from './ValueTransactionSupplyAction';
import config from '@/config';
import { TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/ItemTransactionMobile.module.scss';
import { createPageHref } from '@/utils';
import { pageConfig } from '@/variants';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ItemTransactionMobile = ({ data, isTimestampShown }) => {
	const {
		hash,
		sender,
		recipient,
		value,
		type,
		timestamp,
		direction,
		aliasAction,
		linkAction,
		restrictionAction,
		supplyAction,
		namespaceRegistration,
		proof,
		secret,
		message
	} = data;
	const { t } = useTranslation();
	const typeText = t(`transactionType_${type}`);
	const normalizeMosaicId = id => `${id || ''}`.replace(/^0x/i, '').toUpperCase();
	const isNativeMosaic = mosaicId => normalizeMosaicId(mosaicId) === normalizeMosaicId(config.NATIVE_MOSAIC_ID);
	const transactionValueTypeGroups = pageConfig.transactions?.valueTypeGroups || {};
	const isTransactionTypeInGroup = group => (transactionValueTypeGroups[group] || []).includes(type);
	const isTransactionValueMosaicDetailsHidden = isTransactionTypeInGroup('mosaicDetailsHidden');
	const isMosaicDetailsHidden = mosaic =>
		pageConfig.transactions?.isTransferNonNativeMosaicValueHidden && isTransactionValueMosaicDetailsHidden && !isNativeMosaic(mosaic.id);
	const isAliasTransaction = isTransactionTypeInGroup('aliasAction');
	const isAccountRestrictionActionTransaction = isTransactionTypeInGroup('restrictionAction');
	const isMosaicSupplyChangeTransaction = isTransactionTypeInGroup('mosaicSupplyAction');
	const isNamespaceRegistrationTransaction = isTransactionTypeInGroup('namespaceRegistration');
	const isSecretLockTransaction = isTransactionTypeInGroup('secretLock');
	const isSecretProofTransaction = isTransactionTypeInGroup('secretProof');
	const isKeyLinkTransaction = isTransactionTypeInGroup('keyLinkAction');

	return (
		<div className={styles.itemTransactionMobile}>
			<Link className={styles.mainSection} href={createPageHref('transactions', hash)}>
				<Avatar type="transaction" size="md" value={type} />
				<div className={styles.info}>
					<div className={styles.name}>{typeText}</div>
					<div className="layout-flex-row">
						<ValueTransactionHash value={hash} />
						<div className={styles.valueCell}>
							{isAliasTransaction ? (
								<ValueTransactionAliasAction action={aliasAction} />
							) : isKeyLinkTransaction ? (
								<ValueTransactionAliasAction action={linkAction} />
							) : isAccountRestrictionActionTransaction ? (
								<ValueTransactionRestrictionAction action={restrictionAction} />
							) : isMosaicSupplyChangeTransaction ? (
								<ValueTransactionSupplyAction action={supplyAction} />
							) : isNamespaceRegistrationTransaction ? (
								<ValueTransactionNamespaceRegistration namespaceRegistration={namespaceRegistration} />
							) : isSecretLockTransaction ? (
								<ValueTransactionProof proof={secret} />
							) : isSecretProofTransaction ? (
								<ValueTransactionProof proof={proof} />
							) : (
								<ValueList
									data={value}
									max={2}
									direction="column"
									renderItem={item => (
										<ValueMosaic
											mosaicId={item.id}
											mosaicName={item.name}
											amount={item.amount}
											isTickerShown
											direction={direction}
											isDetailsHidden={isMosaicDetailsHidden(item)}
										/>
									)}
								/>
							)}
							{type === TRANSACTION_TYPE.TRANSFER && <ValueTransactionMessage message={message} isFocusable={false} />}
						</div>
					</div>
				</div>
			</Link>
			<div>
				<ValueAccount address={sender} size="sm" />
				{!!recipient && (
					<div className={styles.row}>
						<CustomImage
							className={styles.iconDirection}
							src="/images/icon-transaction-direction.svg"
							alt="Transaction direction"
						/>
						<ValueAccount address={recipient} size="sm" />
					</div>
				)}
			</div>
			{isTimestampShown && <ValueTimestamp value={timestamp} hasTime />}
		</div>
	);
};

export default ItemTransactionMobile;
