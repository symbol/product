import BlockPreview from './BlockPreview';
import styles from '@/styles/components/RecentBlocks.module.scss';
import { createRef, useRef, useState } from 'react';

const RecentBlocks = ({ data, onTransactionListRequest }) => {
	const containerRef = useRef();
	const [selectedBlockHeight, setSelectedBlockHeight] = useState(-1);
	const [transactions, setTransactions] = useState([]);
	const dataWithRefs = data.map(item => ({
		...item,
		smallBoxRef: createRef(),
		bigBoxRef: createRef()
	}));

	const fetchTransactionList = async height => {
		const transactions = await onTransactionListRequest(height);

		setTransactions(transactions.data);
	};

	const handleBlockSelect = item => {
		setSelectedBlockHeight(item.height);
		setTransactions([]);
		fetchTransactionList(item.height);

		if (item.height > selectedBlockHeight) {
			item.bigBoxRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
				inline: 'center'
			});
		} else {
			item.smallBoxRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
				inline: 'center'
			});
		}
	};
	const handleClose = () => {
		setSelectedBlockHeight(-1);
		scrollStart();
	};
	const scrollStart = () => {
		if (!containerRef.current) return;

		const { scrollWidth } = containerRef.current;
		containerRef.current.scrollBy({ left: -scrollWidth, behavior: 'smooth' });
	};

	return (
		<div className={styles.recentBlocks}>
			<div className={styles.blockPreviewScrollable} ref={containerRef}>
				{dataWithRefs.map(item => (
					<BlockPreview
						isSelected={selectedBlockHeight === item.height}
						data={item}
						transactions={transactions}
						key={item.height}
						smallBoxRef={item.smallBoxRef}
						bigBoxRef={item.bigBoxRef}
						onClose={handleClose}
						onSelect={() => handleBlockSelect(item)}
					/>
				))}
			</div>
		</div>
	);
};

export default RecentBlocks;
