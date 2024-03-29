import WarningModalBox from '../WarningModalBox';

const DetectMetamask = ({ isOpen, onRequestClose }) => {
	const title = 'You don\'t have the Metamask extension';
	const description = 'You need to install Metamask extension in order to use the Symbol snap.';

	return (
		<WarningModalBox
			isOpen={isOpen}
			onRequestClose={onRequestClose}
			title={title}
			description={description}
		>
			<a target="_blank" href="https://metamask.io/">Download MetaMask</a>
		</WarningModalBox>
	);
};

export default DetectMetamask;
