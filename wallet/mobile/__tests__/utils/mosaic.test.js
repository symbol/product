import {
    absoluteToRelativeAmount,
    filterCustomMosaics,
    generateNonce,
    getMosaicAmount,
    isMosaicRevokable,
    isRestrictableFlag,
    isRevokableFlag,
    isSupplyMutableFlag,
    isTransferableFlag,
    mosaicListFromRaw,
    relativeToAbsoluteAmount,
} from '@/app/utils';
import { generateBitCombinations } from '../test-utils';
import * as Crypto from 'crypto';

jest.mock('crypto', () => {
    const actualModule = jest.requireActual('crypto');
    return {
        __esModule: true,
        ...actualModule,
    };
});

const SUPPLY_MUTABLE_FLAG = 1;
const TRANSFERABLE_FLAG = 2;
const RESTRICTABLE_FLAG = 4;
const REVOKABLE_FLAG = 8;

describe('utils/mosaic', () => {
    describe('getMosaicAmount', () => {
        const runGetMosaicAmountTest = (mosaicId, expectedAmount) => {
            // Act:
            const mosaicList = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic2', amount: 200 },
            ];
            const result = getMosaicAmount(mosaicList, mosaicId);

            // Assert:
            expect(result).toBe(expectedAmount);
        };
        it('returns the mosaic amount by mosaic id', () => {
            // Arrange:
            const mosaicId = 'mosaic1';
            const expectedAmount = 100;

            // Act & Assert:
            runGetMosaicAmountTest(mosaicId, expectedAmount);
        });

        it('returns null if the mosaic is not found', () => {
            // Arrange:
            const mosaicId = 'mosaic3';
            const expectedAmount = null;

            // Act & Assert:
            runGetMosaicAmountTest(mosaicId, expectedAmount);
        });

        const runGetMosaicAmountErrorTest = (mosaicList, mosaicId) => {
            // Arrange:
            const expectedErrorMessage = 'Failed to get mosaic amount. Missing required parameters.';

            // Act & Assert:
            expect(() => getMosaicAmount(mosaicList, mosaicId)).toThrow(expectedErrorMessage);
        };

        it('throws an error if the mosaic list is not provided', () => {
            // Arrange:
            const mosaicId = 'mosaic1';
            const mosaicList = null;

            // Act & Assert:
            runGetMosaicAmountErrorTest(mosaicList, mosaicId);
        });

        it('throws an error if the mosaic id is not provided', () => {
            // Arrange:
            const mosaicId = null;
            const mosaicList = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic2', amount: 200 },
            ];

            // Act & Assert:
            runGetMosaicAmountErrorTest(mosaicList, mosaicId);
        });

        it('throws an error if the mosaic id and mosaic list are not provided', () => {
            // Arrange:
            const mosaicId = null;
            const mosaicList = null;

            // Act & Assert:
            runGetMosaicAmountErrorTest(mosaicList, mosaicId);
        });
    });

    describe('absoluteToRelativeAmount', () => {
        it('returns the relative amount', () => {
            // Arrange:
            const absoluteAmount = 123456789;
            const divisibility = 6;
            const expectedRelativeAmount = 123.456789;

            // Act:
            const result = absoluteToRelativeAmount(absoluteAmount, divisibility);

            // Assert:
            expect(result).toBe(expectedRelativeAmount);
        });
    });

    describe('relativeToAbsoluteAmount', () => {
        it('returns the absolute amount', () => {
            // Arrange:
            const relativeAmount = 123.456789;
            const divisibility = 6;
            const expectedAbsoluteAmount = 123456789;

            // Act:
            const result = relativeToAbsoluteAmount(relativeAmount, divisibility);

            // Assert:
            expect(result).toBe(expectedAbsoluteAmount);
        });
    });

    describe('mosaicListFromRaw', () => {
        it('returns the formatted mosaic list', () => {
            // Arrange:
            const rawMosaics = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic2', amount: 200 },
                { id: 'mosaic3', amount: 300 },
            ];
            const mosaicInfos = {
                mosaic1: { name: 'mosaic1', divisibility: 1 },
                mosaic2: { name: 'mosaic2', divisibility: 3 },
            };
            const expectedMosaicList = [
                { id: 'mosaic1', name: 'mosaic1', amount: 10, divisibility: 1 },
                { id: 'mosaic2', name: 'mosaic2', amount: 0.2, divisibility: 3 },
                { id: 'mosaic3', name: 'mosaic3', amount: null },
            ];

            // Act:
            const result = mosaicListFromRaw(rawMosaics, mosaicInfos);

            // Assert:
            expect(result).toEqual(expectedMosaicList);
        });

        const runMosaicListFromRawErrorTest = (rawMosaics, mosaicInfos) => {
            // Arrange:
            const expectedErrorMessage = 'Failed to format mosaics. Missing required parameters.';

            // Act & Assert:
            expect(() => mosaicListFromRaw(rawMosaics, mosaicInfos)).toThrow(expectedErrorMessage);
        };

        it('throws an error if the mosaic list is not provided', () => {
            // Arrange:
            const rawMosaics = null;
            const mosaicInfos = {
                mosaic1: { name: 'mosaic1', divisibility: 6 },
                mosaic2: { name: 'mosaic2', divisibility: 6 },
            };

            // Act & Assert:
            runMosaicListFromRawErrorTest(rawMosaics, mosaicInfos);
        });

        it('throws an error if the mosaic infos are not provided', () => {
            // Arrange:
            const rawMosaics = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic2', amount: 200 },
            ];
            const mosaicInfos = null;

            // Act & Assert:
            runMosaicListFromRawErrorTest(rawMosaics, mosaicInfos);
        });
    });

    describe('filterCustomMosaics', () => {
        it('returns the filtered mosaic list', () => {
            // Arrange:
            const mosaicList = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic2', amount: 200 },
                { id: 'mosaic3', amount: 300 },
            ];
            const mosaicIdToFilter = 'mosaic2';
            const expectedMosaicList = [
                { id: 'mosaic1', amount: 100 },
                { id: 'mosaic3', amount: 300 },
            ];

            // Act:
            const result = filterCustomMosaics(mosaicList, mosaicIdToFilter);

            // Assert:
            expect(result).toEqual(expectedMosaicList);
        });
    });

    describe('isMosaicRevokable', () => {
        const runIsMosaicRevokableTest = ({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult }) => {
            // Act:
            const result = isMosaicRevokable(mosaic, chainHeight, currentAddress, sourceAddress);

            // Assert:
            expect(result).toBe(expectedResult);
        };

        it('returns true if the mosaic is revokable and chain height is less than the mosaic end height', () => {
            // Arrange:
            const chainHeight = 100;
            const currentAddress = 'currentAddress';
            const sourceAddress = 'sourceAddress';
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: false,
                isRevokable: true,
                creator: currentAddress,
            };
            const expectedResult = true;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });

        it('returns true if the mosaic is revokable and is unlimited duration', () => {
            // Arrange:
            const chainHeight = 300;
            const currentAddress = 'currentAddress';
            const sourceAddress = 'sourceAddress';
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: true,
                isRevokable: true,
                creator: currentAddress,
            };
            const expectedResult = true;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });

        it('returns false if the mosaic is not revokable', () => {
            // Arrange:
            const chainHeight = 100;
            const currentAddress = 'currentAddress';
            const sourceAddress = 'sourceAddress';
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: false,
                isRevokable: false,
                creator: currentAddress,
            };
            const expectedResult = false;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });

        it('returns false if the mosaic creator is not the current address', () => {
            // Arrange:
            const chainHeight = 100;
            const currentAddress = 'currentAddress';
            const sourceAddress = 'sourceAddress';
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: false,
                isRevokable: true,
                creator: 'creatorAddress',
            };
            const expectedResult = false;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });

        it('returns false if the source address is the current address', () => {
            // Arrange:
            const chainHeight = 100;
            const currentAddress = 'currentAddress';
            const sourceAddress = currentAddress;
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: false,
                isRevokable: true,
                creator: currentAddress,
            };
            const expectedResult = false;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });

        it('returns false if the mosaic is expired', () => {
            // Arrange:
            const chainHeight = 300;
            const currentAddress = 'currentAddress';
            const sourceAddress = 'sourceAddress';
            const mosaic = {
                id: 'mosaic1',
                amount: 100,
                endHeight: 200,
                isUnlimitedDuration: false,
                isRevokable: true,
                creator: currentAddress,
            };
            const expectedResult = false;

            // Act & Assert:
            runIsMosaicRevokableTest({ mosaic, chainHeight, currentAddress, sourceAddress, expectedResult });
        });
    });

    describe('generateNonce', () => {
        it('generates a random nonce', () => {
            // Arrange:
            const expectedType = 'number';

            // Act:
            const result = generateNonce();

            // Assert:
            expect(result).not.toBeNull();
            expect(typeof result).toBe(expectedType);
        });

        const runNonceRangeTest = (randomBytes, expectedNonce) => {
            // Arrange:
            jest.spyOn(Crypto, 'randomBytes').mockReturnValue(randomBytes);

            // Act:
            const result = generateNonce();

            // Assert:
            expect(result).toBe(expectedNonce);
        };

        it('generates the minimum nonce', () => {
            // Arrange:
            const randomBytes = Buffer.from([0, 0, 0, 0]);
            const expectedNonce = 0;

            // Act & Assert:
            runNonceRangeTest(randomBytes, expectedNonce);
        });

        it('generates the maximum nonce', () => {
            // Arrange:
            const randomBytes = Buffer.from([255, 255, 255, 255]);
            const expectedNonce = 4294967295;

            // Act & Assert:
            runNonceRangeTest(randomBytes, expectedNonce);
        });
    });

    const runMosaicFlagsTest = (flags, expectedResult, flagFunction) => {
        flags.forEach((flag) => {
            // Act:
            const result = flagFunction(flag);

            // Assert:
            expect(result).toBe(expectedResult);
        });
    };

    describe('isSupplyMutableFlag', () => {
        it('returns true if the flag is supply mutable', () => {
            // Arrange:
            const flags = generateBitCombinations(SUPPLY_MUTABLE_FLAG, [TRANSFERABLE_FLAG, RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = true;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isSupplyMutableFlag);
        });

        it('returns false if the flag is not supply mutable', () => {
            // Arrange:
            const flags = generateBitCombinations(TRANSFERABLE_FLAG, [RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = false;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isSupplyMutableFlag);
        });
    });

    describe('isTransferableFlag', () => {
        it('returns true if the flag is transferable', () => {
            // Arrange:
            const flags = generateBitCombinations(TRANSFERABLE_FLAG, [SUPPLY_MUTABLE_FLAG, RESTRICTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = true;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isTransferableFlag);
        });

        it('returns false if the flag is not transferable', () => {
            // Arrange:
            const flags = generateBitCombinations(RESTRICTABLE_FLAG, [SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = false;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isTransferableFlag);
        });
    });

    describe('isRestrictableFlag', () => {
        it('returns true if the flag is restrictable', () => {
            // Arrange:
            const flags = generateBitCombinations(RESTRICTABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = true;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isRestrictableFlag);
        });

        it('returns false if the flag is not restrictable', () => {
            // Arrange:
            const flags = generateBitCombinations(REVOKABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG]);
            const expectedResult = false;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isRestrictableFlag);
        });
    });

    describe('isRevokableFlag', () => {
        it('returns true if the flag is revokable', () => {
            // Arrange:
            const flags = generateBitCombinations(REVOKABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG, REVOKABLE_FLAG]);
            const expectedResult = true;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isRevokableFlag);
        });

        it('returns false if the flag is not revokable', () => {
            // Arrange:
            const flags = generateBitCombinations(RESTRICTABLE_FLAG, [TRANSFERABLE_FLAG, SUPPLY_MUTABLE_FLAG]);
            const expectedResult = false;

            // Act & Assert:
            runMosaicFlagsTest(flags, expectedResult, isRevokableFlag);
        });
    });
});
