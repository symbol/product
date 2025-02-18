import { useEffect } from 'react';

export const useInit = (callback, isReady, deps = []) => {
    useEffect(() => {
        if (isReady) {
            callback();
        }
    }, [isReady, ...deps]);
};
