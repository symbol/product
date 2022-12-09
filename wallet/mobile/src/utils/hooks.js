import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Router } from 'src/Router';

export const usePasscode = (type, onSuccess, onCancel) => {
    const successState = '.s';
    const cancelState = '.c';
    
    return () => {
        const uniqueNumber = Math.floor(Date.now() / 1000);
        const eventId = `event.passcode.${uniqueNumber}`;
        DeviceEventEmitter.addListener(eventId + successState, onSuccess);
        DeviceEventEmitter.addListener(eventId + cancelState, onCancel);

        Router.goToPasscode({
            type,
            successEvent: eventId + successState,
            cancelEvent: eventId + cancelState
        });
    };
}

export const useValidation = (value, validators, formatResult) => {
    for (const validator of validators) {
        const validationResult = validator(value);
        if (validationResult && formatResult) {
            return formatResult(validationResult);
        }

        if (validationResult) {
            return validationResult;
        }
    }
};

export const usePromises = (initialPromiseMap, errorHandler) => {
    const [promiseMap, setPromiseMap] = useState(initialPromiseMap);

    const runPromise = () => {
        setTimeout(async () => {
            for (const promiseKey in promiseMap) {
                const promise = promiseMap[promiseKey];
                
                if (promise) {
                    try {
                        await promise();
                    }
                    catch(error) {
                        if (errorHandler) {
                            errorHandler(error);
                        }
                    }

                    const updatedPromiseMap = {...promiseMap};
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
}

export const useDataManager = (callback, defaultData, onError) => {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(defaultData);

    const call = (...args) => {
        setIsLoading(true);
        setTimeout(async () => {
            try {
                const data = await callback(...args);
                setData(data);
            }
            catch(error) {
                if (onError) {
                    onError(error);
                }
            }
            setIsLoading(false);
        });
    };

    return [call, isLoading, data];
}

export const useProp = (prop) => {
    const [value, setValue] = useState(prop);

    useEffect(() => {
        setValue(prop);
    }, [prop]);

    return [value, setValue];
}

export const useInit = (callback, isReady, deps = []) => {
    useEffect(() => {
        if (isReady) {
            callback();
        }
    }, [isReady, ...deps]);
};

export const useToggle = (initialValue) => {
    const [value, setValue] = useState(initialValue);

    const toggle = () => setValue(value => !value);

    return [value, toggle];
};
