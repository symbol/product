import Field from '@/app/components/Field';
import ValueCopy from '@/app/components/ValueCopy';
import styles from '@/app/styles/components/BlockMerkle.module.scss';
import { useTranslation } from 'next-i18next';

// The REST array follows Symbol's sub-cache order; repeated zero roots still represent distinct caches.
const SUB_CACHE_NAMES = [
	'AccountState',
	'Namespace',
	'Mosaic',
	'Multisig',
	'HashLockInfo',
	'SecretLockInfo',
	'AccountRestriction',
	'MosaicRestriction',
	'Metadata'
];

const BlockMerkle = ({ blockInfo }) => {
	const { t } = useTranslation();
	const roots = blockInfo.stateHashSubCacheMerkleRoots ?? [];

	return (
		<>
			<h3>{t('section_merkleInfo')}</h3>
			<div className="layout-flex-col-fields">
				<Field title={t('field_stateHash')}>
					<ValueCopy className={styles.hash} value={blockInfo.stateHash} />
				</Field>
				<Field title={t('field_stateHashSubCacheMerkleRoots')}>
					{roots.length ? (
						<dl className={styles.roots}>
							{roots.map((root, index) => {
								const cacheName = SUB_CACHE_NAMES[index];
								return (
									<div className={styles.root} key={cacheName}>
										<dt>{cacheName}</dt>
										<dd><ValueCopy className={styles.hash} value={root} /></dd>
									</div>
								);
							})}
						</dl>
					) : '-'}
				</Field>
				<Field title={t('field_receiptsHash')}>
					<ValueCopy className={styles.hash} value={blockInfo.receiptsHash} />
				</Field>
				<Field title={t('field_transactionsHash')}>
					<ValueCopy className={styles.hash} value={blockInfo.transactionsHash} />
				</Field>
			</div>
		</>
	);
};

export default BlockMerkle;
