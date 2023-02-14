import React, { useEffect } from 'react';
import { TextBox } from 'src/components';
import { $t } from 'src/localization';
import { useValidation, validateMnemonic, validateRequired } from 'src/utils';

export const MnemonicInput = (props) => {
    const { testID, value, onChange, onValidityChange } = props;
    const errorMessage = useValidation(value, [validateRequired(), validateMnemonic()], $t);

    const handleChange = (str) =>
        onChange(
            str
                .replace(/(\r\n|\n|\r)/gm, ' ')
                .replace(/\s+/g, ' ')
                .toLowerCase()
        );

    useEffect(() => {
        onValidityChange(!errorMessage);
    }, [value, errorMessage]);

    return <TextBox multiline testID={testID} errorMessage={errorMessage} value={value} onChange={handleChange} />;
};
