import { describeEachVariant, getVariantPublicPath } from './contract-test-helpers';
import { requiredAssets } from '@/contract/assets';
import fs from 'fs';

describe('contract/assets', () => {
	describeEachVariant(variant => {
		requiredAssets.forEach(requiredAssetFolder => {
			it(`directory "${requiredAssetFolder.folder}" contains all required image files`, () => {
				// Arrange:
				const folderPath = getVariantPublicPath(variant, requiredAssetFolder.folder);
				const folderFileNames = fs.readdirSync(folderPath);

				// Act:
				const missingNames = requiredAssetFolder.names.filter(name => !folderFileNames.includes(name));

				// Assert:
				expect(missingNames).toEqual([]);
			});
		});
	});
});
