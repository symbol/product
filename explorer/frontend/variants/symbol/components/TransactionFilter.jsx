import symbolStyles from './TransactionFilter.module.scss';
import en from '../locales/en/transaction-filter.json';
import isv from '../locales/isv/transaction-filter.json';
import ja from '../locales/ja/transaction-filter.json';
import ButtonClose from '@/app/components/ButtonClose';
import CustomImage from '@/app/components/CustomImage';
import Filter from '@/app/components/Filter';
import Modal from '@/app/components/Modal';
import TextBox from '@/app/components/TextBox';
import ValueTransactionType from '@/app/components/ValueTransactionType';
import styles from '@/app/styles/components/Filter.module.scss';
import { createAssetURL } from '@/app/utils';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';

const FILTER_TEXT = { en, isv, ja };
const ADDRESS_PATTERN = /^[A-Z2-7]{39}$/;
const MOSAIC_ID_PATTERN = /^[0-9A-F]{16}$/;
const HEIGHT_PATTERN = /^\d+$/;
const MAX_TRANSACTION_HEIGHT = '9223372036854775807';
const DIRECT_FILTER_NAMES = new Set(['from', 'to', 'mosaic', 'height']);

const activateOnKey = action => event => {
	if (event.key !== 'Enter' && event.key !== ' ')
		return;

	event.preventDefault();
	if (!event.repeat)
		action();
};

const getLocalizedText = (key, language) => {
	const locale = String(language || 'en').toLowerCase().split(/[-_]/)[0];
	const text = FILTER_TEXT[locale] ?? FILTER_TEXT.en;

	return text[key];
};

// Client validation checks only the REST input shape. Symbol REST remains responsible for
// checksum and network validation of addresses.
const normalizeDirectFilter = (name, input, language) => {
	const value = String(input).trim();
	if (!value)
		return { error: getLocalizedText('empty', language) };

	if (name === 'from' || name === 'to') {
		const normalized = value.toUpperCase();
		return ADDRESS_PATTERN.test(normalized)
			? { value: normalized }
			: { error: getLocalizedText('address', language) };
	}

	if (name === 'mosaic') {
		const normalized = value.toUpperCase();
		return MOSAIC_ID_PATTERN.test(normalized)
			? { value: normalized }
			: { error: getLocalizedText('mosaic', language) };
	}

	const normalized = value.replace(/^0+(?=\d)/, '');
	if (!HEIGHT_PATTERN.test(normalized) || normalized === '0')
		return { error: getLocalizedText('height', language) };

	if (normalized.length > MAX_TRANSACTION_HEIGHT.length ||
		(normalized.length === MAX_TRANSACTION_HEIGHT.length && normalized > MAX_TRANSACTION_HEIGHT))
		return { error: getLocalizedText('heightRange', language) };

	return { value: normalized };
};

const hasFieldConflict = (field, value) => Object.keys(value).some(selectedName => field.conflicts?.includes(selectedName));

const TransactionFilter = ({ isSelectedItemsShown, data, value, search, isDisabled, onChange, onClear }) => {
	const { i18n } = useTranslation();
	const [activeField, setActiveField] = useState(null);
	const [draft, setDraft] = useState('');
	const [error, setError] = useState('');
	const typeField = data.find(field => field.type === 'transaction-type');
	const directFields = data.filter(field => DIRECT_FILTER_NAMES.has(field.name));
	const selectedFields = data.filter(field => field.type === 'transaction-type' || DIRECT_FILTER_NAMES.has(field.name));
	const isTypeDisabled = isDisabled || Boolean(value.mosaic || value.to);

	const openField = field => {
		setActiveField(field);
		setDraft(value[field.name] ?? '');
		setError('');
	};

	const closeField = () => {
		setActiveField(null);
		setDraft('');
		setError('');
	};

	const applyField = event => {
		event?.preventDefault();
		if (!activeField || isDisabled)
			return;

		const result = normalizeDirectFilter(activeField.name, draft, i18n?.language);
		if (result.error) {
			setError(result.error);
			return;
		}

		onChange({ ...value, [activeField.name]: result.value });
		closeField();
	};

	const removeField = name => {
		const nextValue = { ...value };
		delete nextValue[name];
		onChange(nextValue);
	};

	return (
		<div className={styles.filter}>
			<div className={`${styles.list} ${symbolStyles.toolbar}`}>
				{typeField && (
					<Filter
						data={[typeField]}
						value={value}
						isDisabled={isTypeDisabled}
						onChange={onChange}
						onClear={onClear}
						search={search}
					/>
				)}
				<div className={styles.filter}>
					<div className={styles.list}>
						{directFields.map(field => {
							const isActive = Object.prototype.hasOwnProperty.call(value, field.name);
							const isAvailable = !isDisabled && !hasFieldConflict(field, value);

							return (
								<div
									role="button"
									tabIndex={isAvailable ? 0 : -1}
									className={`${styles.button} ${isActive ? styles.buttonActive : ''} ${
										!isAvailable ? styles.buttonDisabled : ''
									}`}
									key={field.name}
									aria-selected={isActive}
									aria-disabled={!isAvailable}
									title={field.title}
									onClick={() => isAvailable && openField(field)}
									onKeyDown={activateOnKey(() => isAvailable && openField(field))}
								>
									<div className={`${styles.text} ${isActive ? styles.textActive : ''}`}>{field.title}</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
			{isSelectedItemsShown && (
				<div className={styles.list}>
					{selectedFields.map(field => value[field.name] && (
						<div
							className={styles.selectedItem}
							key={field.name}
							role="button"
							tabIndex={isDisabled ? -1 : 0}
							aria-label={`Remove ${field.title}`}
							aria-disabled={isDisabled}
							onClick={() => !isDisabled && removeField(field.name)}
							onKeyDown={activateOnKey(() => !isDisabled && removeField(field.name))}
						>
							{field.type === 'transaction-type'
								? <ValueTransactionType value={value[field.name]} />
								: <div className={styles.text}>{value[field.name]}</div>}
							<CustomImage
								src={createAssetURL('/images/icon-close.svg')}
								alt="Remove"
								className={styles.iconRemoveItem}
							/>
						</div>
					))}
				</div>
			)}
			<Modal className={`${styles.modal} ${symbolStyles.modal}`} isVisible={!!activeField} onClose={closeField}>
				<ButtonClose className={styles.buttonClose} onClick={closeField} />
				<form className={symbolStyles.form} onSubmit={applyField}>
					<h4>{activeField?.title}</h4>
					<TextBox role="textbox" placeholder={activeField?.name} value={draft} onChange={setDraft} />
					{error && <div role="alert">{error}</div>}
				</form>
			</Modal>
		</div>
	);
};

export default TransactionFilter;
