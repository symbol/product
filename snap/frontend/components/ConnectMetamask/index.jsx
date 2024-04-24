import { actionTypes, useWalletContext } from '../../context';
import symbolSnap from '../../utils/snap';
import WarningModalBox from '../WarningModalBox';

const ConnectMetamask = ({ isOpen, onRequestClose }) => {
	const { dispatch } = useWalletContext();

	const title = 'Connect to MetaMask Symbol Snap';
	const description = 'If you do not have the Symbol snap installed you will be prompted to install it.';

	const handleConnectClick = async () => {
		const isConnected = await symbolSnap().connectSnap();

		dispatch({ type: actionTypes.SET_SNAP_INSTALLED, payload: isConnected });
	};

	return (
		<WarningModalBox
			isOpen={isOpen}
			onRequestClose={onRequestClose}
			title={title}
			description={description}
		>
			<div onClick={handleConnectClick}>Connect MetaMask</div>
		</WarningModalBox>
	);
};

export default ConnectMetamask;
