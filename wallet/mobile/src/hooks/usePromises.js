import { useEffect, useState } from 'react';

export const usePromises = (initialPromiseMap, errorHandler) => {
    const [promiseMap, setPromiseMap] = useState(initialPromiseMap);

    const runPromise = () => {
        setTimeout(async () => {
            for (const promiseKey in promiseMap) {
                const promise = promiseMap[promiseKey];

                if (promise) {
                    try {
                        await promise();
                    } catch (error) {
                        if (errorHandler) {
                            errorHandler(error);
                        }
                    }

                    const updatedPromiseMap = { ...promiseMap };
                    updatedPromiseMap[promiseKey] = null;
                    setPromiseMap(updatedPromiseMap);
                    break;
                }
            }
        });
    };

    useEffect(() => {
        runPromise();
    }, [promiseMap]);

    return [promiseMap, setPromiseMap];
};
