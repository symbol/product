import { useEffect, useState } from 'react';

/**
 * A custom hook that syncs a state variable with a prop.
 * If `prop` is provided, the state follows it; otherwise, it falls back to an initial value.
 *
 * @param {any} prop - The prop value to sync with state. If `undefined`, the state is initialized with `initValue`.
 * @param {any} initValue - The initial value to use if `prop` is `undefined`.
 * @returns {[any, (value: any) => void]} - A tuple containing the current state value and a setter function.
 */
export const useProp = (prop, initValue) => {
    const [value, setValue] = useState(prop === undefined ? initValue : prop);

    useEffect(() => {
        if (prop !== undefined) {
            setValue(prop);
        }
    }, [prop]);

    return [value, setValue];
};
