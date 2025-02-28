import { namespaceFromDTO, namespaceIdFromName, namespaceIdFromRaw } from '@/app/utils';
import {
    namespaceInfoDepth1,
    namespaceInfoDepth2,
    namespaceInfoWithAddressAliasResponse,
    namespaceInfoWithMosaicAliasResponse,
} from '__fixtures__/api/namespace-info-response';

describe('utils/namespace', () => {
    describe('namespaceIdFromName', () => {
        it('generates the namespace id from a given namespace name', () => {
            // Arrange:
            const namespaceName1 = 'cat.currency';
            const namespaceName2 = 'symbol';
            const namespaceName3 = 'symbol.xym';
            const namespaceName4 = 'extra.long.namespace_foo';
            const expectedNamespaceId1 = '85BBEA6CC462B244';
            const expectedNamespaceId2 = 'A95F1F8A96159516';
            const expectedNamespaceId3 = 'E74B99BA41F4AFEE';
            const expectedNamespaceId4 = 'EF40A8BFC0888096';

            // Act:
            const result1 = namespaceIdFromName(namespaceName1);
            const result2 = namespaceIdFromName(namespaceName2);
            const result3 = namespaceIdFromName(namespaceName3);
            const result4 = namespaceIdFromName(namespaceName4);

            // Assert:
            expect(result1).toBe(expectedNamespaceId1);
            expect(result2).toBe(expectedNamespaceId2);
            expect(result3).toBe(expectedNamespaceId3);
            expect(result4).toBe(expectedNamespaceId4);
        });
    });

    describe('namespaceIdFromRaw', () => {
        it('decodes raw namespace id', () => {
            // Arrange:
            const rawNamespaceId1 = '9938FC6801F2DB87D5000000000000000000000000000000';
            const rawNamespaceId2 = '99508915CE0BB840C4000000000000000000000000000000';
            const expectedNamespaceId1 = 'D587DBF20168FC38';
            const expectedNamespaceId2 = 'C440B80BCE158950';

            // Act:
            const result1 = namespaceIdFromRaw(rawNamespaceId1);
            const result2 = namespaceIdFromRaw(rawNamespaceId2);

            // Assert:
            expect(result1).toBe(expectedNamespaceId1);
            expect(result2).toBe(expectedNamespaceId2);
        });
    });

    describe('namespaceFromDTO', () => {
        const runNamespaceFromDTOTest = (namespaceDTO, expectedResult) => {
            // Arrange:
            const namespaceNames = {
                D748B092093AA7A1: 'foo',
                DA664716F7672DD7: 'cat',
            };

            // Act:
            const result = namespaceFromDTO(namespaceDTO, namespaceNames);

            // Assert:
            expect(result).toStrictEqual(expectedResult);
        };

        // Arrange:
        const baseResult = {
            id: 'D748B092093AA7A1',
            name: 'foo',
            aliasType: 'none',
            linkedMosaicId: null,
            linkedAddress: null,
            startHeight: 2000,
            endHeight: 4000,
            creator: 'TALZP6U5S2YWPBVKHD3GY3NHYBVZEMSEFKXAGHY',
        };

        it('formats the namespace DTO', () => {
            // Arrange:
            const namespaceDTO = namespaceInfoDepth1;
            const expectedResult = {
                ...baseResult,
            };

            // Act & Assert:
            runNamespaceFromDTOTest(namespaceDTO, expectedResult);
        });

        it('formats the namespace DTO with address alias', () => {
            // Arrange:
            const namespaceDTO = namespaceInfoWithAddressAliasResponse;
            const expectedResult = {
                ...baseResult,
                aliasType: 'address',
                linkedAddress: 'TALZP6U5S2YWPBVKHD3GY3NHYBVZEMSEFKXAGHY',
            };

            // Act & Assert:
            runNamespaceFromDTOTest(namespaceDTO, expectedResult);
        });

        it('formats the namespace DTO with mosaic alias', () => {
            // Arrange:
            const namespaceDTO = namespaceInfoWithMosaicAliasResponse;
            const expectedResult = {
                ...baseResult,
                aliasType: 'mosaic',
                linkedMosaicId: '699E9532708D2FB8',
            };

            // Act & Assert:
            runNamespaceFromDTOTest(namespaceDTO, expectedResult);
        });

        it('formats the namespace DTO with sub namespace', () => {
            // Arrange:
            const namespaceDTO = namespaceInfoDepth2;
            const expectedResult = {
                ...baseResult,
                id: 'DA664716F7672DD7',
                name: 'foo.cat',
            };

            // Act & Assert:
            runNamespaceFromDTOTest(namespaceDTO, expectedResult);
        });
    });
});
