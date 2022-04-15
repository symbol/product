import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import React, { useState } from 'react';

const PopUpDialog = ({title, content, buttonText}) => {
	const [visible, setVisible] = useState(false);

	const onHide = () => {
		setVisible(false);
	};

	const onShow = () => {
		setVisible(true);
	};

	return  (
		<>
			<Button id="button" onClick={onShow} label={buttonText ?? title}
				className="p-button-secondary p-button-text" />
			<Dialog header={title} visible={visible} onHide={onHide} dismissableMask={true} >
				{ content }
			</Dialog>
		</>
	);
};

export default PopUpDialog;