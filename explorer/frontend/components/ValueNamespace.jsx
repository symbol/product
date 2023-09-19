import Avatar from './Avatar';
import CustomImage from './CustomImage';
import styles from '@/styles/components/ValueNamespace.module.scss';
import Link from 'next/link';

const ValueNamespace = ({ namespaceName, namespaceId, className, size, onClick, isNavigationDisabled }) => {
	const isNameSameAsId = namespaceName === namespaceId;

	const handleClick = e => {
		e.stopPropagation();
		if (!onClick) return;
		if (isNavigationDisabled) e.preventDefault();
		onClick(namespaceId);
	};

	return size === 'md' ? (
		<Link
			className={`${styles.valueNamespace} ${styles.containerMd} ${className}`}
			href={`/namespaces/${namespaceId}`}
			onClick={handleClick}
		>
			<Avatar type="namespace" size="md" value={namespaceId} />
			<div className={styles.valueNamespaceMdTextSection}>
				<div>{namespaceName}</div>
				{!isNameSameAsId && <div>{namespaceId}</div>}
			</div>
		</Link>
	) : (
		<Link href={`/namespaces/${namespaceId}`} className={`${styles.valueNamespace} ${directionStyle} ${className}`} onClick={handleClick}>
			<CustomImage src="" className={styles.icon} alt="Namespace" />
			<div>{namespaceName}</div>
		</Link>
	);
};

export default ValueNamespace;
