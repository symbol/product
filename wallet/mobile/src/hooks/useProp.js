import { useEffect, useState } from 'react';

export const useProp = (prop, initValue) => {
    const [value, setValue] = useState(prop === undefined ? initValue : prop);

    useEffect(() => {
        if (prop !== undefined) {
            setValue(prop);
        }
    }, [prop]);

    return [value, setValue];
};
