import { useWalletContext } from '../../context';
import Dropdown from '../Dropdown';
import Image from 'next/image';
import { useState } from 'react';

const Navbar = () => {
	const { walletState } = useWalletContext();
	const { isSnapInstalled } = walletState;

	const networks = [
		{ label: 'Mainnet', value: 'mainnet' },
		{ label: 'Testnet', value: 'testnet' }
	];

	const currencies = [
		{ label: 'USD', value: 'usd' },
		{ label: 'JPY', value: 'jpy' }
	];

	const [selectedNetwork, setSelectedNetwork] = useState('Network');
	const [selectedCurrency, setSelectedCurrency] = useState('Currency');

	const handleSelectNetwork = option => {
		setSelectedNetwork(option.label);
	};

	const handleSelectCurrency = option => {
		setSelectedCurrency(option.label);
	};

	return (
		<div className='flex items-center justify-between'>
			<div >
				<Image
					src='/symbol-logo.svg'
					width={200}
					height={50}
					alt='Symbol logo'
				/>
			</div>

			<div className='flex items-center'>
				<Dropdown label={selectedNetwork} options={networks} onSelect={handleSelectNetwork}/>
				<Dropdown label={selectedCurrency} options={currencies} onSelect={handleSelectCurrency} />
				<div role='connection-status' className={`rounded-full w-5 h-5 ml-2 ${isSnapInstalled ? 'bg-green' :'bg-red-500'}`}></div>
			</div>
		</div>
	);
};

export default Navbar;