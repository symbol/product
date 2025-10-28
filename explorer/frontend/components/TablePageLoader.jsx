import LoadingIndicator from './LoadingIndicator';
import styles from '@/styles/components/TablePageLoader.module.scss';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

const TablePageLoader = ({ onLoad, isLoading }) => {
	const loadingRef = useInView({ threshold: 0 });
	const refLoadingTarget = loadingRef.ref;
	const isLoadingTargetInView = loadingRef.inView;

	const handleTargetInView = () => {
		if (isLoadingTargetInView && !isLoading) 
			onLoad();
	};
	useEffect(handleTargetInView, [isLoadingTargetInView, isLoading, onLoad]);

	return (
		<div className={styles.tablePageLoader}>
			<div ref={refLoadingTarget} />
			{isLoading && <LoadingIndicator />}
		</div>
	);
};

export default TablePageLoader;
