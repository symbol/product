import Avatar from '@/app/components/Avatar';
import CustomImage from '@/app/components/CustomImage';
import ValueAccount from '@/app/components/ValueAccount';
import ValueMosaic from '@/app/components/ValueMosaic';
import ValueNamespace from '@/app/components/ValueNamespace';
import ValueTransactionType from '@/app/components/ValueTransactionType';
import styles from '@/app/styles/components/TransactionGraphic.module.scss';
import { createAssetURL } from '@/app/utils';
import { useTranslation } from 'next-i18next';

const targetRenderers = {
	account: value => <ValueAccount className={styles.target} address={value} size="md" position="right" />,
	lock: (value, t) => (
		<div className={`${styles.target} ${styles.lock}`}>
			<Avatar type="lock" size="md" />
			<div>{t('value_lockDuration', { duration: value })}</div>
		</div>
	),
	mosaic: value => <ValueMosaic className={styles.target} mosaicId={value} mosaicName={value} size="md" />,
	namespace: value => <ValueNamespace className={styles.target} namespaceId={value} namespaceName={value} size="md" />
};

const TransactionGraphic = ({ transaction, target }) => {
	const { t } = useTranslation();

	return (
		<div className={styles.transactionGraphic}>
			<div className={styles.titleRow}>
				<div>{t('field_sender')}</div>
				{!!target && <div>{t(target.localeKey)}</div>}
			</div>
			<ValueAccount className={styles.source} address={transaction.sender} size="md" position="left" />
			<CustomImage src={createAssetURL('/images/transaction-arrow.svg')} className={styles.arrow} alt="Transaction direction" />
			<ValueTransactionType hideIcon className={styles.transactionType} value={transaction.type} />
			{!!target && targetRenderers[target.renderer](transaction[target.name], t)}
		</div>
	);
};

export default TransactionGraphic;
