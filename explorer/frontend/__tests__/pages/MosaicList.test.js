import '@testing-library/jest-dom';
import { customMosaic, nativeMosaic } from '../../__fixtures__/local/mosaic';
import { mosaicList } from '../../__fixtures__/local/mosaic-list';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as BlockService from '@/app/api/blocks';
import * as MosaicService from '@/app/api/mosaics';
import MosaicList, { getServerSideProps } from '@/app/pages/mosaics';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/mosaics')
	};
});

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

beforeEach(() => {
	jest.spyOn(BlockService, 'fetchChainHight').mockResolvedValue(activeChainHeight);
});

// Constants

const SCREEN_TEXT = {
	sectionMosaics: 'section_mosaics',
	tableFieldName: 'table_field_name',
	tableFieldCreator: 'table_field_creator',
	tableFieldStatus: 'table_field_status',
	tableFieldRegistrationHeight: 'table_field_registrationHeight',
	fieldCreated: 'field_created',
	fieldTimestampUTC: 'field_timestampUTC',
	labelActive: 'label_active',
	labelExpired: 'label_expired'
};

const createdTimestampText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldCreated}`;
const activeChainHeight = customMosaic.namespaceExpirationHeight - 1;
const expiredChainHeight = customMosaic.namespaceExpirationHeight + 1;
const mosaicPage = {
	data: mosaicList,
	pageNumber: 1
};

// Tests

describe('MosaicList', () => {
	describe('getServerSideProps', () => {
		const requests = { mosaicPage: [MosaicService, 'fetchMosaicPage'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the mosaics props',
				config: {
					responses: { mosaicPage }
				},
				expected: {
					requestArguments: { mosaicPage: [] },
					result: {
						props: { mosaics: mosaicList }
					}
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			BlockService.fetchChainHight.mockResolvedValue(config.chainHeight ?? activeChainHeight);
			render(<MosaicList mosaics={config.mosaics} />);
		};

		describe('section: mosaics', () => {
			const mosaicsCases = [
				{
					description: 'renders the table headers and the mosaic rows',
					config: { mosaics: mosaicList },
					expected: {
						texts: [
							SCREEN_TEXT.sectionMosaics,
							SCREEN_TEXT.tableFieldName,
							SCREEN_TEXT.tableFieldCreator,
							SCREEN_TEXT.tableFieldStatus,
							SCREEN_TEXT.tableFieldRegistrationHeight,
							createdTimestampText,
							...mosaicList.map(mosaic => mosaic.name),
							...mosaicList.map(mosaic => mosaic.creator),
							...mosaicList.map(mosaic => mosaic.registrationHeight)
						]
					}
				},
				{
					description: 'renders the active status when the chain height is below the expiration height',
					config: {
						mosaics: [customMosaic],
						chainHeight: activeChainHeight
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 1,
							[SCREEN_TEXT.labelExpired]: 0
						}
					}
				},
				{
					description: 'renders the expired status when the chain height is above the expiration height',
					config: {
						mosaics: [customMosaic],
						chainHeight: expiredChainHeight
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 0,
							[SCREEN_TEXT.labelExpired]: 1
						}
					}
				},
				{
					description: 'renders the active status when the mosaic has an unlimited duration',
					config: {
						mosaics: [nativeMosaic],
						chainHeight: expiredChainHeight
					},
					expected: {
						titleOccurrences: {
							[SCREEN_TEXT.labelActive]: 1,
							[SCREEN_TEXT.labelExpired]: 0
						}
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: mosaicsCases });
		});
	});
});
