import ExportButton from './ExportButton';
import { fetchReportPage } from '@/api/bridge';
import ReportTable from '@/components/ReportTable';
import { PAGE_SIZE, PAYOUT_STATUS_OPTIONS } from '@/constants';
import styles from '@/styles/ReportPanel.module.css';
import { parseSearchInput } from '@/utils/validation';
import { useCallback, useEffect, useRef, useState } from 'react';

const createDefaultCriteria = (tab, baseUrl) => ({
	baseUrl,
	operation: tab.operation,
	resource: tab.resource,
	limit: PAGE_SIZE,
	payoutStatus: null,
	search: '',
	sort: 0
});

const ReportPanel = ({ tab, isActive, baseUrl, configuration }) => {
	const [searchInput, setSearchInput] = useState('');
	const [validationError, setValidationError] = useState('');
	const [criteria, setCriteria] = useState(() => createDefaultCriteria(tab, baseUrl));
	const [rows, setRows] = useState([]);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState('');
	const criteriaRef = useRef(criteria);
	const nextOffsetRef = useRef(0);
	const hasLoadedRef = useRef(false);
	const isLoadingRef = useRef(false);
	const abortControllerRef = useRef(null);
	const tableViewportRef = useRef(null);
	const sentinelRef = useRef(null);

	const loadPage = useCallback(async ({ offset = 0, replace = false } = {}) => {
		if (isLoadingRef.current && !replace)
			return;

		if (replace)
			abortControllerRef.current?.abort();

		const abortController = new AbortController();
		abortControllerRef.current = abortController;
		isLoadingRef.current = true;
		setIsLoading(true);
		setLoadError('');

		try {
			const page = await fetchReportPage({
				...criteriaRef.current,
				offset,
				signal: abortController.signal
			});
			if (abortControllerRef.current !== abortController)
				return;

			setRows(currentRows => replace ? page.data : [...currentRows, ...page.data]);
			setHasMore(page.hasMore);
			nextOffsetRef.current = page.nextOffset;
			hasLoadedRef.current = true;
		} catch (error) {
			if (!abortController.signal.aborted && abortControllerRef.current === abortController)
				setLoadError(error.message || 'Unable to load this report.');
		} finally {
			if (abortControllerRef.current === abortController) {
				isLoadingRef.current = false;
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (isActive && !hasLoadedRef.current && !isLoadingRef.current)
			loadPage({ replace: true });
	}, [isActive, loadPage]);

	useEffect(() => () => abortControllerRef.current?.abort(), []);

	useEffect(() => {
		if (!hasLoadedRef.current || !isActive || !hasMore || isLoading || loadError
			|| !sentinelRef.current || !globalThis.IntersectionObserver)
			return undefined;

		const observer = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting)
				loadPage({ offset: nextOffsetRef.current });
		}, {
			root: tableViewportRef.current,
			rootMargin: '200px'
		});
		observer.observe(sentinelRef.current);

		return () => observer.disconnect();
	}, [hasMore, isActive, isLoading, loadError, loadPage]);

	const updateCriteria = nextCriteria => {
		criteriaRef.current = nextCriteria;
		setCriteria(nextCriteria);
	};

	const resetWithCriteria = nextCriteria => {
		updateCriteria(nextCriteria);
		setRows([]);
		setHasMore(true);
		nextOffsetRef.current = 0;
		hasLoadedRef.current = false;
		if (isActive)
			loadPage({ replace: true });
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

	const changeSort = () => {
		const sort = 0 === criteriaRef.current.sort ? 1 : 0;
		resetWithCriteria({ ...criteriaRef.current, sort });
	};

	const retryLoad = () => {
		loadPage({
			offset: rows.length ? nextOffsetRef.current : 0,
			replace: !rows.length
		});
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

				<ExportButton criteria={criteria} tab={tab} />
			</div>
			<div className={styles.tableViewport} ref={tableViewportRef}>
				{Boolean(rows.length) && (
					<ReportTable
						configuration={configuration}
						onSortChange={changeSort}
						rows={rows}
						sort={criteria.sort}
						tab={tab}
					/>
				)}
				{isLoading && (
					<div className={styles.loader} role="status"><span aria-hidden="true" />Loading report…</div>
				)}
				{loadError && (
					<div className={styles.stateMessage} role="alert">
						<span>{loadError}</span>
						<button className={styles.retryButton} onClick={retryLoad} type="button">Retry</button>
					</div>
				)}
				{hasLoadedRef.current && !rows.length && !isLoading && !loadError && (
					<div className={styles.stateMessage}>No records found.</div>
				)}
				{Boolean(rows.length) && !hasMore && !isLoading && !loadError && (
					<div className={styles.endMessage}>End of report</div>
				)}
				{hasMore && !loadError && <div className={styles.sentinel} ref={sentinelRef} />}
			</div>
		</section>
	);
};

export default ReportPanel;
