import ButtonClose from './ButtonClose';
import CustomImage from './CustomImage';
import Field from './Field';
import LoadingIndicator from './LoadingIndicator';
import Modal from './Modal';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import ValueTransactionType from './ValueTransactionType';
import styles from '@/styles/components/Filter.module.scss';
import { useDataManager, useDelayedCall } from '@/utils';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';

const renderItem = (item, type, onSelect) => {
	switch (type) {
		case 'account':
			return (
				<ValueAccount
					address={item.address}
					size="md"
					isNavigationDisabled
					isCopyDisabled
					onClick={() => onSelect(item.address, item)}
				/>
			);
		case 'mosaic':
			return (
				<ValueMosaic
					mosaicName={item.name}
					mosaicId={item.id}
					size="md"
					isNavigationDisabled
					onClick={() => onSelect(item.id, item)}
				/>
			);
		case 'transaction-type':
			return <ValueTransactionType value={item.type} onClick={() => onSelect(item, item)} />;
		default:
			return item;
	}
};

const FilterModal = ({ isVisible, title, type, isSearchEnabled, options, onSearchRequest, onClose, onSelect }) => {
	const [text, setText] = useState('');
	const [searchResult, setSearchResult] = useState(null);
	const [search, isLoading] = useDataManager(async text => {
		const searchResult = await onSearchRequest(text);
		if (searchResult?.[type]) setSearchResult(searchResult[type]);
		else setSearchResult(null);
	});
	const [delayedSearch] = useDelayedCall(text => search(text));
	const handleSearchTextChange = text => {
		setText(text);
		delayedSearch(text);
	};
	const list = searchResult ? [searchResult] : options;
	const listTitle = !isSearchEnabled ? '' : searchResult ? 'Search results' : options.length ? 'Suggestions' : '';

	return (
		<Modal className={styles.modal} onClose={onClose} isVisible={isVisible}>
			<ButtonClose className={styles.buttonClose} onClick={onClose} />
			<h4>{title}</h4>
			{isSearchEnabled && (
				<TextBox iconSrc="/images/icon-search.svg" placeholder={type} value={text} onChange={handleSearchTextChange} />
			)}
			{isLoading && <LoadingIndicator className={styles.loadingIndicator} />}
			<Field title={listTitle} className={styles.resultListField}>
				<div className={styles.resultListContent}>
					{list.map((item, index) => (
						<div className={styles.resultItem} key={'result' + index}>
							{renderItem(item, type, onSelect)}
						</div>
					))}
				</div>
			</Field>
		</Modal>
	);
};

const Filter = ({ isSelectedItemsShown, data, value, search, isDisabled, onChange }) => {
	const { t } = useTranslation();
	const [expandedFilter, setExpandedFilter] = useState({});
	const [selectedItems, setSelectedItems] = useState({});

	const isFilerActive = name => !!value[name];
	const isFilterAvailable = name =>
		(!Object.keys(value).some(selectedFilterName =>
			data.find(filter => filter.name === selectedFilterName)?.conflicts?.some(conflictFilterName => conflictFilterName === name)
		) ||
			value.hasOwnProperty(name)) &&
		!isDisabled;
	const getButtonStyle = name => `
        ${styles.button}
        ${isFilerActive(name) ? styles.buttonActive : null}
		${!isFilterAvailable(name) ? styles.buttonDisabled : null}
    `;
	const getTextStyle = name => `${styles.text} ${isFilerActive(name) ? styles.textActive : null}`;
	const clear = () => {
		setExpandedFilter(null);
		onChange({});
	};
	const handleFilterPress = filter => {
		if (!isFilterAvailable(filter.name)) {
			return;
		}

		if (filter.type === 'boolean') {
			changeFilterValue(filter, !value[filter.name]);
		} else {
			setExpandedFilter(filter);
		}
	};
	const handleFilterSelection = (value, item) => {
		changeFilterValue(expandedFilter, value, item);
		setExpandedFilter(null);
	};
	const changeFilterValue = (filter, filterValue, item) => {
		const currentFilterValues = { ...value };

		filter.off?.forEach(filterName => delete currentFilterValues[filterName]);

		if (filterValue) {
			currentFilterValues[filter.name] = filterValue;
		} else {
			delete currentFilterValues[filter.name];
		}

		setSelectedItems(selectedItems => {
			const updatedSelectedItems = { ...selectedItems };
			updatedSelectedItems[filter.name] = item;

			return updatedSelectedItems;
		});
		onChange(currentFilterValues);
	};
	const removeFilter = filter => {
		changeFilterValue(filter, null);
	};

	const isFilterModalShown = ['account', 'mosaic', 'transaction-type'].some(value => value === expandedFilter?.type);

	useEffect(() => {
		const updatedSelectedItems = { ...selectedItems };
		Object.keys(updatedSelectedItems).forEach(
			key => !Object.keys(value).some(filterValueKey => filterValueKey === key) && delete updatedSelectedItems[key]
		);
		setSelectedItems(updatedSelectedItems);
	}, [value, selectedItems]);

	return (
		<div className={styles.filter}>
			<div className={styles.list}>
				<div className={styles.button} onClick={clear} role="button">
					<CustomImage src={'/images/icon-chip-clear.png?d=1'} className={styles.icon} />
					<div className={styles.text}>{t('button_clear')}</div>
				</div>
				{data.map((item, index) => (
					<div
						className={getButtonStyle(item.name)}
						key={'filter' + index}
						role="button"
						onClick={() => !isDisabled && handleFilterPress(item, true)}
					>
						<div className={getTextStyle(item.name)}>{item.title}</div>
					</div>
				))}
			</div>
			<div className={styles.list}>
				{isSelectedItemsShown &&
					data.map(
						(item, index) =>
							selectedItems[item.name] && (
								<div className={styles.selectedItem} key={index}>
									{renderItem(selectedItems[item.name], item.type, () => removeFilter(item))}
								</div>
							)
					)}
			</div>
			<FilterModal
				isVisible={isFilterModalShown}
				title={expandedFilter?.title}
				type={expandedFilter?.type}
				isSearchEnabled={expandedFilter?.isSearchEnabled}
				options={expandedFilter?.options || []}
				onClose={() => setExpandedFilter(null)}
				onSelect={handleFilterSelection}
				onSearchRequest={search}
			/>
		</div>
	);
};

export default Filter;
