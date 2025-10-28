import styles from '@/styles/components/Dropdown.module.scss';
import { useState } from 'react';

export const Dropdown = props => {
	const { options, value, className, onChange } = props;
	const valueText = (options.find(item => item.value === value) || {}).label || value;
	const sortedOptions = options.sort((a, b) => (a.value == value ? -1 : b.value == value ? 1 : 0));

	const [isExpanded, setIsExpanded] = useState(false);
	const toggle = e => {
		e.stopPropagation();
		setIsExpanded(v => !v);
	};

	return (
		<div className={`${styles.dropdown} ${className}`}>
			<button className={styles.button} onClick={toggle}>
				{valueText}
				<svg className={styles.icon} viewBox="0 0 7 4" fill="none">
					<path d="M1 1L3.37497 3.375L5.74997 1" strokeWidth="1.1875" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
				{isExpanded && (
					<div className={styles.options}>
						<div className={styles.overlay} />
						{sortedOptions.map(item => (
							<button className={styles.option} onClick={() => onChange(item.value)} key={item.value}>
								{item.label}
							</button>
						))}
					</div>
				)}
			</button>
		</div>
	);
};
