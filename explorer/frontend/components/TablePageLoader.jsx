import styles from '@/styles/components/TablePageLoader.module.scss';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

const TablePageLoader = ({ onLoad, isLoading }) => {
	const loadingRef = useInView({ threshold: 0 });
	const refLoadingTarget = loadingRef.ref;
	const isLoadingTargetInView = loadingRef.inView;

	const handleTargetInView = () => {
		if (isLoadingTargetInView && !isLoading) {
			onLoad();
		}
	};
	useEffect(handleTargetInView, [isLoadingTargetInView, isLoading, onLoad]);

	return (
		<div className={styles.tablePageLoader}>
			<div ref={refLoadingTarget} />
			{isLoading && (
				<svg className={styles.spinner} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
					<circle className={styles.path} fill="none" cx="40" cy="40" r="30" strokeWidth="8"></circle>
				</svg>
			)}
		</div>
	);
};

export default TablePageLoader;
