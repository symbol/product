import useWalletInstallation from '../../hooks/useWalletInstallation';
import AccountBalance from '../AccountBalance';
import AccountInfo from '../AccountInfo';
import AssetList from '../AssetList';
import ConnectMetamask from '../ConnectMetamask';
import DetectMetamask from '../DetectMetamask';
import Navbar from '../Navbar';
import TransactionTable from '../TransactionTable';

const Home = () => {
	const { isMetamaskInstalled, isSnapInstalled } = useWalletInstallation();

	const mockTransactions = [
		{
			sender: 'NDUGJWR3NASYOM4FMRCLD2UCLXEYQOVHSH4GVEI',
			transactionType: 'Reclaim',
			amount: null,
			currency: null,
			message: null,
			transactionHash: '730DD2C509533DC7BE91B4B11AAD62732EEDA0C056ACF4538551D10A9AB63D6B',
			date: null,
			height: null
		},
		{
			sender: 'NDUGJWR3NASYOM4FMRCLD2UCLXEYQOVHSH4GVEI',
			transactionType: 'Transfer',
			amount: '10.000000',
			currency: '50.00 JPY',
			message: 'Send',
			transactionHash: 'BFA649B68A9B30FE9BF5C6AF9BE16C066588EA8766999AD56A81783FD50E360E',
			date: '2024-02-29 18:55:40',
			height: 1684644
		},
		{
			sender: 'NBQE6M2DQDAI7QFWX5YGAU7XOA6JNZEZQCRXRMA',
			transactionType: 'Transfer',
			amount: '10.000000',
			currency: '50.00 JPY',
			message: null,
			transactionHash: 'A1ADB0380C268ED66F3B1C0B020FCA8FC7C9F8EE129D679D9AEDDD9DD98D4776',
			date: '2024-03-1 18:55:40',
			height: 1684645
		},
		{
			sender: 'NDUGJWR3NASYOM4FMRCLD2UCLXEYQOVHSH4GVEI',
			transactionType: 'Reclaim',
			amount: null,
			currency: null,
			message: null,
			transactionHash: '730DD2C509533DC7BE91B4B11AAD62732EEDA0C056ACF4538551D10A9AB63D6B',
			date: '2024-03-2 18:55:40',
			height: 1684646
		}
	];

	return (
		<div className='m-auto max-w-screen-xl min-w-[910px] max-h-min p-5'>
			{
				!isMetamaskInstalled ?
					<DetectMetamask isOpen={!isMetamaskInstalled} onRequestClose={() => false} /> :
					!isSnapInstalled ?
						<ConnectMetamask isOpen={!isSnapInstalled} onRequestClose={() => false} /> :
						null
			}

			<Navbar />

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
							<button className='bg-secondary border-2 m-2 rounded-xl uppercase w-40 h-10'>Receive</button>
							<button className='bg-secondary border-2 m-2 rounded-xl uppercase w-40 h-10'>Send</button>
						</div>
					</div>

					<TransactionTable transactions={mockTransactions} />
				</div>
			</div>
		</div>
	);
};

export default Home;
