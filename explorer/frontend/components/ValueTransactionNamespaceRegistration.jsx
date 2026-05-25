import styles from '@/styles/components/ValueTransactionNamespaceRegistration.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const ValueTransactionNamespaceRegistration = ({ namespaceRegistration }) => {
	const { t } = useTranslation();

	if (!namespaceRegistration)
		return null;

	const typeLabelKey = namespaceRegistration.registrationType === 'sub' ? 'filter_subNamespace' : 'filter_rootNamespace';
	const namespaceLinkId = namespaceRegistration.id || namespaceRegistration.name;

	return (
		<Link
			className={styles.valueTransactionNamespaceRegistration}
			href={createPageHref('namespaces', namespaceLinkId)}
		>
			<span className={styles.type}>{t(typeLabelKey)}</span>
			<span className={styles.name}>{namespaceRegistration.name}</span>
		</Link>
	);
};

export default ValueTransactionNamespaceRegistration;
