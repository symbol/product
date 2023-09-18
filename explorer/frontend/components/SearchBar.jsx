import Field from './Field';
import ItemTransactionMobile from './ItemTransactionMobile';
import Modal from './Modal';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import ValueBlockHeight from './ValueBlockHeight';
import ValueMosaic from './ValueMosaic';
import ValueTransaction from './ValueTransaction';
import ValueTransactionHash from './ValueTransactionHash';
import ValueTransactionType from './ValueTransactionType';
import styles from '@/styles/components/SearchBar.module.scss';
import { useDataManager, useDelayedCall } from '@/utils';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';

const SearchResults = ({ type, text, onSearchRequest, onSelect }) => {
	const { t } = useTranslation();
	const [result, setResult] = useState({});
	const isNothingFound = Object.keys(result).length === 0 && !isLoading;
	const isAccountResult = !!result.account && (!type || type === 'account');
	const isBlockResult = !!result.block && (!type || type === 'block');
	const isMosaicResult = !!result.mosaic && (!type || type === 'mosaic');
	const isTransactionResult = !!result.transaction && (!type || type === 'transaction');

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
		<div className="layout-flex-col-fields">
			{isAccountResult && (
				<Field title={t('Account')}>
					<ValueAccount address={result.account.address} size="md" onClick={onSelect} />
				</Field>
			)}
			{isBlockResult && (
				<Field title={t('Block')}>
					<ValueBlockHeight value={result.block.height} timestamp={result.block.timestamp} size="md" onClick={onSelect} />
				</Field>
			)}
			{isMosaicResult && (
				<Field title={t('Mosaic')}>
					<ValueMosaic mosaicName={result.mosaic.name} mosaicId={result.mosaic.id} size="md" onClick={onSelect} />
				</Field>
			)}
			{isTransactionResult && (
				<Field title={t('Transaction')}>
					<ValueTransaction value={result.transaction.hash} type={result.transaction.type} size="md" onClick={onSelect} />
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
			<Modal className={modalClassName} isVisible={isModalVisible} onClose={closeModal}>
				<div className="layout-flex-col">
					<h4>Search</h4>
					<SearchResults text={text} onSearchRequest={onSearchRequest} onSelect={closeModal} />
				</div>
			</Modal>
		</div>
	);
};

export default SearchBar;
