import { useState } from 'react';

/**
 * A custom hook that manages a boolean state with a toggle function.
 *
 * @param {boolean} initialValue - The initial boolean state value.
 * @returns {[boolean, () => void]} - A tuple containing the current boolean state and a function to toggle it.
 */
export const useToggle = (initialValue) => {
    const [value, setValue] = useState(initialValue);

    const toggle = () => setValue((value) => !value);

    return [value, toggle];
};
