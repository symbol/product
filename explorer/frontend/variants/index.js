import { DocumentHead as NemDocumentHead } from './nem/DocumentHead';
import * as nemAPI from './nem/api';
import { pageConfig as nemPageConfig } from './nem/config';
import { DocumentHead as SymbolDocumentHead } from './symbol/DocumentHead';
import * as symbolAPI from './symbol/api';
import { pageConfig as symbolPageConfig } from './symbol/config';

const variants = {
	nem: {
		platform: 'nem',
		api: nemAPI,
		DocumentHead: NemDocumentHead,
		pageConfig: nemPageConfig
	},
	symbol: {
		platform: 'symbol',
		api: symbolAPI,
		DocumentHead: SymbolDocumentHead,
		pageConfig: symbolPageConfig
	}
};

const getPlatform = () => process.env.NEXT_PUBLIC_PLATFORM;

const loadVariant = () => {
	const platform = getPlatform();
	const selectedVariant = variants[platform];

	if (!selectedVariant)
		throw new Error('NEXT_PUBLIC_PLATFORM must be set to either "nem" or "symbol".');

	return selectedVariant;
};

export const variant = loadVariant();
export const { api } = variant;
export const { DocumentHead } = variant;
export const { pageConfig } = variant;
