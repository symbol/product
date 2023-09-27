import Progress from './Progress';
import ValueNamespace from './ValueNamespace';
import styles from '@/styles/components/ItemNamespaceMobile.module.scss';
import { useTranslation } from 'next-i18next';

const ItemNamespaceMobile = ({ data, chainHeight }) => {
	const { t } = useTranslation();
	const { name, id, registrationHeight, expirationHeight } = data;
	const expireIn = expirationHeight - chainHeight;
	const isExpired = expireIn < 0;
	const progressType = isExpired ? 'danger' : '';

	return (
		<div className={styles.itemNamespaceMobile}>
			<ValueNamespace namespaceName={name} namespaceId={id} size="md" />
			<Progress
				titleLeft={t('field_registrationHeight')}
				titleRight={t('field_expirationHeight')}
				valueLeft={registrationHeight}
				valueRight={expirationHeight}
				value={chainHeight}
				type={progressType}
			/>
		</div>
	);
};

export default ItemNamespaceMobile;
