import React, { useCallback, useState } from 'react';
import { Button } from '@/app/components';
import { $t } from '@/app/localization';

export const useSendButton = () => {
    const [props, setProps] = useState({});

    const SendButton = useCallback((directProps) => (
        <Button
            title={directProps.title || $t('button_send')}
            isDisabled={props.isDisabled}
            onPress={props.onPress}
        />
    ), [props.isDisabled, props.onPress]);

    return {
        Component: SendButton,
        setProps,
    };
};
