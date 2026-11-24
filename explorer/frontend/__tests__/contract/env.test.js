import { describeEachVariant, loadVariantModule } from './contract-test-helpers';
import { envKeysByVariant } from '@/contract/env';

const ENV_CONFIG_PATH = 'config/env-config';

describe('contract/env', () => {
	describeEachVariant(variant => {
		it('env config defines all required keys', () => {
			// Arrange:
			const { envConfig } = loadVariantModule(variant, ENV_CONFIG_PATH);
			const requiredKeys = envKeysByVariant[variant];

			// Act:
			const missingKeys = requiredKeys?.filter(key => !(key in envConfig));

			// Assert:
			expect(envKeysByVariant).toHaveProperty(variant);
			expect(missingKeys).toEqual([]);
		});
	});
});
