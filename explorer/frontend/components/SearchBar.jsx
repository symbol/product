import Field from './Field';
import Modal from './Modal';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import ValueBlockHeight from './ValueBlockHeight';
import ValueMosaic from './ValueMosaic';
import styles from '@/styles/components/SearchBar.module.scss';
import { useDataManager, useDelayedCall } from '@/utils';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';

const SearchResults = ({ type, text, onSearchRequest }) => {
	const { t } = useTranslation();
	const [result, setResult] = useState({});
	const isNothingFound = Object.keys(result).length === 0 && !isLoading;
	const isAccountResult = !!result.account && (!type || type === 'account');
	const isBlockResult = !!result.block && (!type || type === 'block');
	const isMosaicResult = !!result.mosaic && (!type || type === 'mosaic');

	const [search, isLoading] = useDataManager(async text => {
		const searchResult = await onSearchRequest(text);

		if (searchResult) setResult(searchResult);
		else setResult({});
	});
	const [delayedSearch] = useDelayedCall(text => search(text));

	useEffect(() => {
		delayedSearch(text.trim());
	}, [text]);

	return (
		<div>
			{isAccountResult && (
				<Field title={t('Account')}>
					<ValueAccount address={result.account.address} size="md" />
				</Field>
			)}
			{isBlockResult && (
				<Field title={t('Block')}>
					<ValueBlockHeight value={result.block.height} />
				</Field>
			)}
			{isMosaicResult && (
				<Field title={t('Mosaic')}>
					<ValueMosaic mosaicName={result.mosaic.name} mosaicId={result.mosaic.id} />
				</Field>
			)}
			{isNothingFound && <div className={styles.notFoundMessage}>{t('message_nothingFound')}</div>}
		</div>
	);
};

const SearchBar = ({ className, modalClassName, onSearchRequest }) => {
	const [text, setText] = useState('');
	const isModalVisible = text.length > 0;

	const closeModal = () => {
		setText('');
	};

	return (
		<div>
			<TextBox
				className={`${styles.textBox} ${className}`}
				iconSrc="/images/icon-search.svg"
				placeholder={'Search'}
				value={text}
				onChange={setText}
			/>
			<Modal className={modalClassName} isVisible={isModalVisible} onClose={closeModal} onClick={closeModal}>
				<div className="layout-flex-col">
					<h4>Search</h4>
					<SearchResults text={text} onSearchRequest={onSearchRequest} />
				</div>
			</Modal>
		</div>
	);
};

export default SearchBar;
