import Field from './Field';
import LoadingIndicator from './LoadingIndicator';
import Modal from './Modal';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import ValueBlockHeight from './ValueBlockHeight';
import ValueMosaic from './ValueMosaic';
import ValueNamespace from './ValueNamespace';
import ValueTransaction from './ValueTransaction';
import styles from '@/styles/components/SearchBar.module.scss';
import { useDataManager, useDebounce } from '@/utils';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';

const SearchResults = ({ type, text, onSearchRequest, onSelect }) => {
	const { t } = useTranslation();
	const [result, setResult] = useState({});

	const [search, isLoading] = useDataManager(
		async text => {
			const searchResult = await onSearchRequest(text);

			if (searchResult) setResult(searchResult);
			else setResult({});
		},
		null,
		null,
		true
	);
	const [delayedSearch] = useDebounce(text => search(text));

	const isNothingFound = Object.keys(result).length === 0 && !isLoading;
	const isAccountResult = !!result.account && !isLoading && (!type || type === 'account');
	const isBlockResult = !!result.block && !isLoading && (!type || type === 'block');
	const isMosaicResult = !!result.mosaic && !isLoading && (!type || type === 'mosaic');
	const isNamespaceResult = !!result.namespace && !isLoading && (!type || type === 'namespace');
	const isTransactionResult = !!result.transaction && !isLoading && (!type || type === 'transaction');

	useEffect(() => {
		delayedSearch(text.trim());
	}, [text]);

	return (
		<div className="layout-flex-col-fields">
			{isAccountResult && (
				<Field title={t('field_account')}>
					<ValueAccount address={result.account.address} size="md" onClick={onSelect} />
				</Field>
			)}
			{isBlockResult && (
				<Field title={t('field_block')}>
					<ValueBlockHeight value={result.block.height} timestamp={result.block.timestamp} size="md" onClick={onSelect} />
				</Field>
			)}
			{isMosaicResult && (
				<Field title={t('field_mosaic')}>
					<ValueMosaic mosaicName={result.mosaic.name} mosaicId={result.mosaic.id} size="md" onClick={onSelect} />
				</Field>
			)}
			{isNamespaceResult && (
				<Field title={t('field_namespace')}>
					<ValueNamespace namespaceName={result.namespace.name} namespaceId={result.namespace.id} size="md" onClick={onSelect} />
				</Field>
			)}
			{isTransactionResult && (
				<Field title={t('field_transaction')}>
					<ValueTransaction
						value={result.transaction.hash}
						type={result.transaction.type}
						amount={result.transaction.amount}
						size="md"
						onClick={onSelect}
					/>
				</Field>
			)}
			{isNothingFound && <div className={styles.notFoundMessage}>{t('message_nothingFound')}</div>}
			{isLoading && <LoadingIndicator className={styles.loadingIndicator} />}
		</div>
	);
};

const SearchBar = ({ className, modalClassName, onSearchRequest }) => {
	const { t } = useTranslation();
	const [text, setText] = useState('');
	const isModalVisible = text.length > 0;

	const closeModal = () => {
		setText('');
	};

	return (
		<div>
			<Modal className={modalClassName} isVisible={isModalVisible} onClose={closeModal}>
				<div className="layout-flex-col">
					<h4>{t('field_search')}</h4>
					<SearchResults text={text} onSearchRequest={onSearchRequest} onSelect={closeModal} />
				</div>
			</Modal>
			<TextBox
				className={`${styles.textBox} ${className}`}
				iconSrc="/images/icon-search.svg"
				placeholder={t('field_search')}
				value={text}
				onChange={setText}
			/>
		</div>
	);
};

export default SearchBar;
