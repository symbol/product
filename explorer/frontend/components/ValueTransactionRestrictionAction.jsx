import styles from '@/styles/components/ValueTransactionAliasAction.module.scss';

const ValueTransactionRestrictionAction = ({ action }) => {
	if (!action)
		return null;

	const items = [
		{
			count: action.added,
			label: 'added'
		},
		{
			count: action.removed,
			label: 'removed'
		}
	].filter(item => item.count > 0);

	if (!items.length)
		return null;

	return (
		<>
			{items.map(item => (
				<span className={styles.valueTransactionAliasAction} key={item.label}>
					{`${item.count} ${item.label}`}
				</span>
			))}
		</>
	);
};

export default ValueTransactionRestrictionAction;
