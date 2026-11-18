import { describeEachBrand, loadBrandModule } from './contract-test-helpers';
import { requiredComponents } from '@/contract/components';

describe('contract/components', () => {
	describeEachBrand(brand => {
		requiredComponents.forEach(requiredComponent => {
			it(`exports the ${requiredComponent.exportName} component`, () => {
				// Act:
				const brandModule = loadBrandModule(brand, requiredComponent.path);

				// Assert:
				expect(brandModule[requiredComponent.exportName]).toEqual(expect.any(Function));
			});
		});
	});
});
