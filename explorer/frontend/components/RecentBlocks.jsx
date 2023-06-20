import { createRef, useRef, useState } from 'react';
import styles from '@/styles/components/RecentBlocks.module.scss';
import BlockPreview from './BlockPreview';

const RecentBlocks = ({ data }) => {
	const containerRef = useRef();
	const [isButtonLeftVisible, setIsButtonLeftVisible] = useState(false);
	const [selectedBlockHeight, setSelectedBlockHeight] = useState(-1);
	const dataWithRefs = data.map((item) => ({
		...item,
		smallBoxRef: createRef(),
		bigBoxRef: createRef(),
	}))

	const handleBlockSelect = (item) => {
		setSelectedBlockHeight(item.height);

		if (item.height > selectedBlockHeight) {
			item.bigBoxRef.current.scrollIntoView({
				behavior: 'smooth',
				block: "center",
				inline: 'center'
			});
		}
		else {
			item.smallBoxRef.current.scrollIntoView({
				behavior: 'smooth',
				block: "center",
				inline: 'center'
			});
		}
	};
	const handleClose = () => setSelectedBlockHeight(-1);
	const scrollLeft = () => {
		if (!containerRef.current) return;

		const containerWidth = containerRef.current.offsetWidth;
		const currentScrollPosition = containerRef.current.scrollLeft;
		const scrollAmount = - containerWidth / 2;
		containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
		setIsButtonLeftVisible(currentScrollPosition + scrollAmount > 0);
	};
	const scrollRight = () => {
		if (!containerRef.current) return;

		const containerWidth = containerRef.current.offsetWidth;
		const scrollAmount = containerWidth / 2;
		containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
		setIsButtonLeftVisible(true);
	}

	return (
		<div className={styles.recentBlocks}>
			<div className={styles.blockPreviewScrollable} ref={containerRef}>
				{dataWithRefs.map((item, key) => (
					<BlockPreview
						isSelected={selectedBlockHeight === item.height}
						data={item}
						key={key}
						smallBoxRef={item.smallBoxRef}
						bigBoxRef={item.bigBoxRef}
						onClose={handleClose}
						onSelect={() => handleBlockSelect(item)}
					/>
				))}
			</div>
			{isButtonLeftVisible && (
				<img className={`${styles.buttonLeft} no-mobile`} src="/images/icon-left.svg" onClick={scrollLeft}/>
			)}
			<img className={`${styles.buttonRight} no-mobile`} src="/images/icon-right.svg" onClick={scrollRight}/>
		</div>
	);
};

export default RecentBlocks;
