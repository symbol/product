import { useWalletContext } from '../../context';
import helper from '../../utils/helper';
import Dropdown from '../Dropdown';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const Navbar = () => {
	const { walletState, dispatch, symbolSnap } = useWalletContext();
	const { isSnapInstalled, network, currency } = walletState;

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

	const handleSelectNetwork = async option => {
		if (option.label === selectedNetwork)
			return;

		// switch network
		await helper.setupSnap(dispatch, symbolSnap, option.value);

		setSelectedNetwork(option.label);
	};

	const handleSelectCurrency = async option => {
		if (option.label === selectedCurrency)
			return;

		// switch currency
		await helper.getCurrency(dispatch, symbolSnap, option.value);

		setSelectedCurrency(option.label);
	};

	useEffect(() => {
		// set selected network in dropdown label
		if (network && network.hasOwnProperty('networkName')) {
			const selected = networks.find(n => n.value === network.networkName);
			if (selected)
				setSelectedNetwork(selected.label);
		}

		// set selected currency in dropdown label
		if (currency) {
			const selected = currencies.find(c => c.value === currency.symbol);
			if (selected)
				setSelectedCurrency(selected.label);
		}
	}, [network]); // eslint-disable-line react-hooks/exhaustive-deps

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
