import { namespaceFromDTO } from '../../src/utils';
import { accountNamespaceDTO, namespaceInfoDTO } from '../__fixtures__/api/namespace-dtos';
import { namespace as expectedNamespace } from '../__fixtures__/local/namespace';

// Both DTO shapes describe the same namespace, so they map to the same Namespace object.

describe('utils/namespace', () => {
	describe('namespaceFromDTO', () => {
		const runNamespaceFromDTOTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = namespaceFromDTO(config.namespaceDTO);

				// Assert:
				expect(result).toStrictEqual(expected.namespace);
			});
		};

		const namespaceFromDTOTests = [
			{
				description: 'maps a wrapped namespace DTO from the account namespace page',
				config: { namespaceDTO: accountNamespaceDTO },
				expected: { namespace: expectedNamespace }
			},
			{
				description: 'maps an unwrapped namespace info DTO',
				config: { namespaceDTO: namespaceInfoDTO },
				expected: { namespace: expectedNamespace }
			},
			{
				description: 'falls back to the numeric id when the fully qualified name is absent',
				config: { namespaceDTO: { id: 12345, owner: expectedNamespace.owner, height: expectedNamespace.height } },
				expected: {
					namespace: { id: '12345', name: '12345', height: expectedNamespace.height, owner: expectedNamespace.owner }
				}
			}
		];

		namespaceFromDTOTests.forEach(test => runNamespaceFromDTOTest(test.description, test.config, test.expected));
	});
});
