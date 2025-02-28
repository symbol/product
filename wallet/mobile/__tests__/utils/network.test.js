import { createNetworkMap, makeRequest, networkIdentifierToNetworkType, networkTypeToIdentifier } from '@/app/utils';
import { NetworkRequestError } from '@/app/lib/error';

describe('utils/network', () => {
    describe('networkTypeToIdentifier', () => {
        it('returns the network identifier from a given network type', () => {
            // Arrange:
            const networkTypesAndExpectedIdentifiers = [
                { networkType: 104, expectedIdentifier: 'mainnet' },
                { networkType: 152, expectedIdentifier: 'testnet' },
            ];

            networkTypesAndExpectedIdentifiers.map(({ networkType, expectedIdentifier }) => {
                // Act:
                const result = networkTypeToIdentifier(networkType);

                // Assert:
                expect(result).toBe(expectedIdentifier);
            });
        });
    });

    describe('networkIdentifierToNetworkType', () => {
        it('returns the network type from a given network identifier', () => {
            // Arrange:
            const networkIdentifiersAndExpectedTypes = [
                { networkIdentifier: 'mainnet', expectedType: 104 },
                { networkIdentifier: 'testnet', expectedType: 152 },
            ];

            networkIdentifiersAndExpectedTypes.map(({ networkIdentifier, expectedType }) => {
                // Act:
                const result = networkIdentifierToNetworkType(networkIdentifier);

                // Assert:
                expect(result).toBe(expectedType);
            });
        });
    });

    describe('createNetworkMap', () => {
        it('creates a network map', () => {
            // Arrange:
            const callback = jest.fn().mockImplementation((networkIdentifier) => networkIdentifier + 'Callback');
            const expectedNetworkMap = {
                mainnet: 'mainnetCallback',
                testnet: 'testnetCallback',
            };

            // Act:
            const result = createNetworkMap(callback);

            // Assert:
            expect(result).toEqual(expectedNetworkMap);
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenCalledWith('mainnet');
            expect(callback).toHaveBeenCalledWith('testnet');
        });
    });

    describe('makeRequest', () => {
        it('makes an HTTP request', async () => {
            // Arrange:
            const expectedData = { data: 100 };
            jest.spyOn(global, 'fetch').mockImplementation(
                jest.fn(() =>
                    Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(expectedData),
                    })
                )
            );
            const url = 'https://edpoint.com/foo/1';
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ foo: 'bar' }),
            };

            // Act:
            const result = await makeRequest(url, options);

            // Assert:
            expect(result).toStrictEqual(expectedData);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(url, options);
        });

        const runMakeRequestErrorTest = async (response, status, statusText, expectedError) => {
            // Arrange:
            jest.spyOn(global, 'fetch').mockImplementation(
                jest.fn(() =>
                    Promise.resolve({
                        ok: false,
                        json: () => Promise.resolve(response),
                        status,
                        statusText,
                    })
                )
            );
            const url = 'https://edpoint.com/foo/1';

            // Act & Assert:
            await expect(makeRequest(url)).rejects.toStrictEqual(expectedError);
        };

        it('throws specific error when the response is not ok', async () => {
            // Arrange:
            const tests = [
                {
                    response: { message: 'errorFromJson' },
                    status: 400,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(400, 'error_fetch_invalid_request', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 409,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(409, 'error_fetch_invalid_request', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 404,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(404, 'error_fetch_not_found', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 429,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(429, 'error_fetch_rate_limit', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 500,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(500, 'error_fetch_server_error', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 502,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(502, 'error_fetch_server_error', 'errorFromJson'),
                },
                {
                    response: { message: 'errorFromJson' },
                    status: 999,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(999, 'error_network_request_error', 'errorFromJson'),
                },
                {
                    response: null,
                    status: 400,
                    statusText: 'Bad Request',
                    expectedError: new NetworkRequestError(400, 'error_fetch_invalid_request', 'Bad Request'),
                },
            ];

            // Act & Assert:
            for (const test of tests) {
                await runMakeRequestErrorTest(test.response, test.status, test.statusText, test.expectedError);
            }
        });
    });
});
