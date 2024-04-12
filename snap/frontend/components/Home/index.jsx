import useWalletInstallation from '../../hooks/useWalletInstallation';
import ConnectMetamask from '../ConnectMetamask';
import DetectMetamask from '../DetectMetamask';

const Home = () => {
	const { isMetamaskInstalled, isSnapInstalled } = useWalletInstallation();

	return (
		<div className='m-auto max-w-screen-xl min-w-[910px] max-h-min p-5'>
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
