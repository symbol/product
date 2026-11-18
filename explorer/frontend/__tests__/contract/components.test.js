import { describeEachVariant, loadVariantModule } from './contract-test-helpers';
import { requiredComponents } from '@/contract/components';

describe('contract/components', () => {
	describeEachVariant(variant => {
		requiredComponents.forEach(requiredComponent => {
			it(`exports the ${requiredComponent.exportName} component`, () => {
				// Act:
				const variantModule = loadVariantModule(variant, requiredComponent.path);

				// Assert:
				expect(variantModule[requiredComponent.exportName]).toEqual(expect.any(Function));
			});
		});
	});
});
