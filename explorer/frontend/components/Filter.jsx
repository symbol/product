import styles from '@/styles/components/Filter.module.scss';
import { useState } from 'react';
import CustomImage from './CustomImage';
import { useTranslation } from 'next-i18next';
import Card from './Card';
import ButtonClose from './ButtonClose';
import TextBox from './TextBox';
import { useDelayedCall } from '@/utils';
import ValueAccount from './ValueAccount';
import ValueMosaic from './ValueMosaic';
import Field from './Field';

const FilterModal = ({ title, type, options, onSearchRequest, onClose, onSelect }) => {
	const [text, setText] =  useState('');
	const [searchResult, setSearchResult] =  useState(null);
	const [search] = useDelayedCall(async (text) => {
		const searchResult = await onSearchRequest(text);
		if (searchResult?.[type])
			setSearchResult(searchResult[type]);
		else
			setSearchResult(null)
	});
	const handleSearchTextChange = (text) => {
		setText(text);
		search(text);
	}
	const renderItem = (item) => {
		switch(type) {
			case 'account': return <ValueAccount address={item.address} size="sm" onClick={() => onSelect(item.address)} />
			case 'mosaic': return <ValueMosaic mosaicName={item.name} mosaicId={item.id} size="md" onClick={() => onSelect(item.id)} />
			default: return item;
		}
	}
	const list = searchResult ? [searchResult] : options;
	const listTitle = searchResult
		? 'Search results'
		: options.length
		? 'Suggestions'
		: '';

	return (
		<div className={styles.modal} onClick={onClose}>
			<Card className={styles.card} onClick={e => e.stopPropagation()}>
				<ButtonClose className={styles.buttonClose} onClick={onClose} />
				<h3>{title}</h3>
				<TextBox
					iconSrc="/images/icon-search.svg"
					placeholder={type} value={text}
					onChange={handleSearchTextChange}
				/>
				<Field title={listTitle}>
					<div className={styles.resultList}>
						{list.map((item, index) => (
							<div
								className={styles.resultItem}
								key={'result' + index}
							>
								{renderItem(item)}
							</div>
						))}
					</div>
				</Field>
			</Card>
		</div>
	);
};

const Filter = ({ data, value, search, isDisabled, onChange }) => {
	const { t } = useTranslation();
    const [expandedFilter, setExpandedFilter] = useState({});

    const isFilerActive = (name) => !!value[name];
    const isFilterAvailable = (name) => (Object.keys(value).length === 0 || value.hasOwnProperty(name)) && !isDisabled;
    const getButtonStyle = (name) => `
        ${styles.button}
        ${isFilerActive(name) ? styles.buttonActive : null}
		${!isFilterAvailable(name) ? styles.buttonDisabled : null}
    `;
    const getTextStyle = (name) => `${styles.text} ${isFilerActive(name) ? styles.textActive : null}`;
    const clear = () => {
		setExpandedFilter(null);
		onChange({});
	};
    const handleFilterPress = (filter) => {
        if (!isFilterAvailable(filter.name)) {
            return;
        }

        if (filter.type === 'boolean') {
            changeFilterValue(filter, !value[filter.name]);
        } else {
            setExpandedFilter(filter);
        }
    };
	const handleFilterSelection = (value) => {
		changeFilterValue(expandedFilter, value);
		setExpandedFilter(null);
	}
    const changeFilterValue = (filter, filterValue) => {
        const currentFilterValues = { ...value };

        if (filterValue) {
            currentFilterValues[filter.name] = filterValue;
        } else {
            delete currentFilterValues[filter.name];
        }

        onChange(currentFilterValues);
    };

	const isFilterModalShown = expandedFilter?.type === 'account' || expandedFilter?.type === 'mosaic';

    return (
        <div className={styles.filter}>
            <div className={styles.list}>
				<div className={styles.button} onClick={clear} role="button">
					<CustomImage src={'/images/icon-chip-clear.png?d=1'} className={styles.icon} />
					<div className={styles.text}>
						{t('button_clear')}
					</div>
				</div>
				{data.map((item, index) => (
					<div
						className={getButtonStyle(item.name)}
						key={'filter' + index}
						role="button"
						onClick={() => !isDisabled && handleFilterPress(item, true)}
					>
						<div className={getTextStyle(item.name)}>
							{item.title}
						</div>
                    </div>
				))}
			</div>
            {isFilterModalShown && (
				<FilterModal
					title={expandedFilter.title}
					type={expandedFilter?.type}
					options={expandedFilter.options || []}
					onClose={() => setExpandedFilter(null)}
					onSelect={handleFilterSelection}
					onSearchRequest={search}
				/>
            )}
			{JSON.stringify(value)}
        </div>
    );
};

export default Filter;
