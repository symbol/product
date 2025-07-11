import config from '@/config';

import nemVariables from './nem/styles/variables.json';
import symbolVariables from './symbol/styles/variables.json';

import nemLayoutStyles from './nem/styles/Layout.module.scss';
import symbolLayoutStyles from './symbol/styles/Layout.module.scss';

import { DocumentHead as nemDocumentHead } from './nem/DocumentHead';
import { DocumentHead as symbolDocumentHead } from './symbol/DocumentHead';

import { pageConfig as nemPageConfig } from './nem/config';
import { pageConfig as symbolPageConfig } from './symbol/config';

import * as nemAPI from './nem/api';
import * as symbolAPI from './symbol/api';

export const styleVariablesVariants = {
    nem: nemVariables,
    symbol: symbolVariables
};

export const layoutStylesVariants = {
    nem: nemLayoutStyles,
    symbol: symbolLayoutStyles
};

export const documentHeadVariants = {
    nem: nemDocumentHead,
    symbol: symbolDocumentHead
};

export const pageConfigVariants = {
    nem: nemPageConfig,
    symbol: symbolPageConfig
};

export const apiVariants = {
	nem: nemAPI,
	symbol: symbolAPI
};

export const styleVariables = styleVariablesVariants[config.PLATFORM];
export const layoutStyles = layoutStylesVariants[config.PLATFORM];
export const DocumentHead = documentHeadVariants[config.PLATFORM];
export const pageConfig = pageConfigVariants[config.PLATFORM];
export const api = apiVariants[config.PLATFORM];
