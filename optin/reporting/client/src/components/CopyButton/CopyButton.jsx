import Helper from './../../utils/helper';
import {Button} from 'primereact/button';
import React from 'react';
import './CopyButton.scss';

const onCopyHandler = value => {
	Helper.copyToClipboard(value);
};

const CopyButton = ({ value, onCopy = onCopyHandler }) => {
	const button = value ? <Button icon="pi pi-copy" className="p-button-text copy-button" onClick={() => onCopy(value)} /> : null;
	return (
		<React.Fragment>
			{button}
		</React.Fragment>
	);
};

export default CopyButton;
