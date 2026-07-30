import { PAGE_SIZE, PAYOUT_STATUS_OPTIONS } from '@/constants';
import styles from '@/styles/ReportPanel.module.css';
import { parseSearchInput } from '@/utils/validation';
import { useRef, useState } from 'react';

const createDefaultCriteria = tab => ({
	baseUrl: tab.baseUrl,
	operation: tab.operation,
	resource: tab.resource,
	limit: PAGE_SIZE,
	payoutStatus: null,
	search: '',
	sort: 0
});

const ReportPanel = ({ tab, isActive }) => {
	const [searchInput, setSearchInput] = useState('');
	const [validationError, setValidationError] = useState('');
	const [criteria, setCriteria] = useState(() => createDefaultCriteria(tab));
	const criteriaRef = useRef(criteria);

	const updateCriteria = nextCriteria => {
		criteriaRef.current = nextCriteria;
		setCriteria(nextCriteria);
	};

	const resetWithCriteria = nextCriteria => {
		updateCriteria(nextCriteria);
		// Todo: to load page with latest criteria
	};

	const handleSearchSubmit = event => {
		event.preventDefault();
		const parsedSearch = parseSearchInput(searchInput);
		if (!parsedSearch) {
			setValidationError('Enter a valid Symbol or Ethereum address, or a 64-character transaction hash.');
			return;
		}

		setValidationError('');
		resetWithCriteria({ ...criteriaRef.current, search: parsedSearch.value });
	};

	const clearSearch = () => {
		setSearchInput('');
		setValidationError('');
		if (criteriaRef.current.search)
			resetWithCriteria({ ...criteriaRef.current, search: '' });
	};

	const changePayoutStatus = payoutStatus => {
		resetWithCriteria({ ...criteriaRef.current, payoutStatus });
	};

	return (
		<section
			aria-labelledby={`tab-${tab.id}`}
			className={`${styles.panel} ${isActive ? styles.activePanel : ''}`}
			hidden={!isActive}
			id={`panel-${tab.id}`}
			role="tabpanel"
		>
			<div className={styles.toolbar}>
				<div className={styles.searchArea}>
					<form className={styles.searchForm} onSubmit={handleSearchSubmit}>
						<span aria-hidden="true" className={styles.searchIcon}>⌕</span>
						<input
							aria-describedby={validationError ? `search-error-${tab.id}` : undefined}
							aria-invalid={Boolean(validationError)}
							aria-label="Filter by address or transaction hash"
							onChange={event => setSearchInput(event.target.value)}
							placeholder="Address or transaction hash — press Enter"
							type="text"
							value={searchInput}
						/>
						{searchInput && (
							<button aria-label="Clear search" className={styles.clearButton} onClick={clearSearch} type="button">×</button>
						)}
					</form>
					{validationError && (
						<span className={styles.validationError} id={`search-error-${tab.id}`} role="alert">{validationError}</span>
					)}
				</div>

				{'requests' === tab.resource && (
					<div aria-label="Payout status" className={styles.statusFilters} role="group">
						{PAYOUT_STATUS_OPTIONS.map(option => (
							<button
								aria-pressed={criteria.payoutStatus === option.value}
								className={criteria.payoutStatus === option.value ? styles.filterActive : ''}
								key={option.label}
								onClick={() => changePayoutStatus(option.value)}
								type="button"
							>
								{option.label}
							</button>
						))}
					</div>
				)}
			</div>
		</section>
	);
};

export default ReportPanel;
