import { useState } from 'react';

export const useRender = () => {
    const [, setRenderTrigger] = useState(0);

    const triggerRender = () => {
        setRenderTrigger(prev => prev + 1);
    };

    return triggerRender;
};
