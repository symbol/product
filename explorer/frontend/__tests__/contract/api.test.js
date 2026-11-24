import { describeEachVariant, loadVariantModule } from './contract-test-helpers';
import { requiredApiModules } from '@/contract/api';

describe('contract/api', () => {
	describeEachVariant(variant => {
		requiredApiModules.forEach(requiredApiModule => {
			it(`${requiredApiModule.path} exports all required functions`, () => {
				// Arrange:
				const variantModule = loadVariantModule(variant, requiredApiModule.path);

				// Act:
				const missingNames = requiredApiModule.exportNames.filter(name => typeof variantModule[name] !== 'function');

				// Assert:
				expect(missingNames).toEqual([]);
			});
		});
	});
});
