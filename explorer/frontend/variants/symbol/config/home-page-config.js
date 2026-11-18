import { Finalization } from '../components/Finalization';

/** @typedef {import('@/contract/types/Config').HomePageConfig} HomePageConfig */

/** @type {HomePageConfig} */
export const homePageConfig = {
	isSupernodeCountVisible: false,
	sections: [
		{ id: 'finalization', Component: Finalization }
	]
};
