import { useWalletContext } from '../../context';
import useWalletInstallation from '../../hooks/useWalletInstallation';
import helper from '../../utils/helper';
import AccountBalance from '../AccountBalance';
import AccountInfo from '../AccountInfo';
import AssetList from '../AssetList';
import ConnectMetamask from '../ConnectMetamask';
import LoadingScreen from '../LoadingScreen';
import Navbar from '../Navbar';
import ReceiveModalBox from '../ReceiveModalBox';
import TransactionTable from '../TransactionTable';
import { useEffect, useState } from 'react';

const Home = () => {
	const { isSnapInstalled } = useWalletInstallation();
	const { dispatch, symbolSnap } = useWalletContext();

	const [ receiveModalBoxVisible, setReceiveModalBoxVisible ] = useState(false);

	const handleReceiveModalBox = () => {
		setReceiveModalBoxVisible(!receiveModalBoxVisible);
	};

	useEffect(() => {
		const initializeSnap = async () => {
			if (isSnapInstalled)
				await helper.setupSnap(dispatch, symbolSnap, 'mainnet', 'USD');
		};

		initializeSnap();
	}, [isSnapInstalled]); // eslint-disable-line react-hooks/exhaustive-deps


	return (
		<div className='m-auto max-w-screen-xl min-w-[910px] max-h-min p-5'>
			{
				!isSnapInstalled ?
					<ConnectMetamask isOpen={!isSnapInstalled} onRequestClose={() => false} /> :
					null
			}

			<Navbar />

			<LoadingScreen />

			<div className='flex items-center mt-4'>
				{/* Left Panel */}
				<div className='flex flex-col h-[500px] min-w-[240px] w-1/4 bg-primary rounded-md mr-4 text-200'>
					{/* Account Info */}
					<AccountInfo />

					{/* Divider  */}
					<div className="border-t-[1px] border-text"></div>

					{/* Asset Table */}
					<AssetList />
				</div>

				{/* Right Panel */}
				<div className='flex flex-col h-[500px] min-w-[670px] w-3/4 rounded-md  bg-primary'>
					{/* Account Balance container */}
					<div className='flex flex-col h-48 justify-center items-center w-full'>
						<AccountBalance />

						{/* Show Button Receive and Send */}
						<div className='flex justify-center font-bold pt-2'>
							<button className='bg-secondary border-2 m-2 rounded-xl uppercase w-40 h-10'
								onClick={handleReceiveModalBox}>Receive</button>
							<button className='bg-secondary border-2 m-2 rounded-xl uppercase w-40 h-10'>Send</button>
						</div>

						<ReceiveModalBox isOpen={receiveModalBoxVisible} onRequestClose={setReceiveModalBoxVisible} />
					</div>

					<TransactionTable />
				</div>
			</div>
		</div>
	);
};

export default Home;
