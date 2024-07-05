import Avatar from './Avatar';
import styles from '@/styles/components/AccountMultisigTree.module.scss';
import { createPageHref } from '@/utils';
import Link from 'next/link';

const AccountMultisigTree = ({ address, cosignatories, cosignatoryOf }) => {
	const isMultisigAccount = cosignatories.length > 0;
	const isCosignatoryAccount = cosignatoryOf.length > 0;

	return (
		<div className={styles.accountMultisigTree}>
			<div className={styles.container}>
				{isCosignatoryAccount && (
					<div>
						<div className={styles.accountListContainer}>
							{cosignatoryOf.map((item, index) => (
								<Link
									className={styles.accountWithLine}
									title={item}
									key={'mul' + index}
									href={createPageHref('blocks', item)}
								>
									<Avatar value={item} type="account" size="md" />
									<div className={styles.lineVertical} />
								</Link>
							))}
						</div>
						<div className={styles.lineHorizontal} />
					</div>
				)}
				<div className={styles.accountWithLine} title={address}>
					{isCosignatoryAccount && <div className={styles.lineVertical} />}
					<Avatar value={address} type="account" size="lg" />
					{isMultisigAccount && <div className={styles.lineVertical} />}
				</div>
				{isMultisigAccount && (
					<div>
						<div className={styles.lineHorizontal} />
						<div className={styles.accountListContainer}>
							{cosignatories.map((item, index) => (
								<Link
									className={styles.accountWithLine}
									title={item}
									key={'cos' + index}
									href={createPageHref('blocks', item)}
								>
									<div className={styles.lineVertical} />
									<Avatar value={item} type="account" size="md" />
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default AccountMultisigTree;
