import { describeEachVariant, loadVariantModule } from './contract-test-helpers';
import { requiredUtilsModules } from '@/contract/utils';

describe('contract/utils', () => {
	describeEachVariant(variant => {
		requiredUtilsModules.forEach(requiredUtilsModule => {
			it(`${requiredUtilsModule.path} exports all required functions`, () => {
				// Arrange:
				const variantModule = loadVariantModule(variant, requiredUtilsModule.path);

				// Act:
				const missingNames = requiredUtilsModule.exportNames.filter(name => typeof variantModule[name] !== 'function');

				// Assert:
				expect(missingNames).toEqual([]);
			});
		});
	});
});
