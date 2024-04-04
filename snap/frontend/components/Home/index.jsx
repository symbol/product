import useWalletInstallation from '../../hooks/useWalletInstallation';
import ConnectMetamask from '../ConnectMetamask';
import DetectMetamask from '../DetectMetamask';

const Home = () => {
	const { isMetamaskInstalled, isSnapInstalled } = useWalletInstallation();

	return (
		<div className='m-auto max-w-screen-xl max-h-min'>
			Symbol Snap
			{
				!isMetamaskInstalled ?
					<DetectMetamask isOpen={!isMetamaskInstalled} onRequestClose={() => false} /> :
					!isSnapInstalled ?
						<ConnectMetamask isOpen={!isSnapInstalled} onRequestClose={() => false} /> :
						<div>connected</div>
			}
		</div>
	);
};

export default Home;
