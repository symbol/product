import WarningModalBox from '../WarningModalBox';

const ConnectMetamask = ({ isOpen, onRequestClose }) => {
	const title = 'Connect to MetaMask Symbol Snap';
	const description = 'If you do not have the Symbol snap installed you will be prompted to install it.';

	return (
		<WarningModalBox
			isOpen={isOpen}
			onRequestClose={onRequestClose}
			title={title}
			description={description}
		>
			<div>Connect MetaMask</div>
		</WarningModalBox>
	);
};

export default ConnectMetamask;
