import Helper from './../../utils/helper';
import {Button} from 'primereact/button';
import React from 'react';
import './CopyButton.scss';

const onCopyHandler = value => {
	Helper.copyToClipboard(value);
};

const CopyButton = ({ value, onCopy = onCopyHandler }) => {
	if (!value)
		return undefined;
	return (
		<React.Fragment>
			<Button icon="pi pi-copy" className="p-button-text copy-button" onClick={() => onCopy(value)} />
		</React.Fragment>
	);
};

export default CopyButton;