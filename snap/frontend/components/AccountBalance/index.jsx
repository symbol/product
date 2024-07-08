import { useWalletContext } from '../../context';

const AccountBalance = () => {
	const { walletState } = useWalletContext();
	const { selectedAccount, currency, network, mosaicInfo } = walletState;
	const { symbol, price } = currency;

	const getXYMMosaic = () => {
		const balance = selectedAccount?.mosaics?.find(m => network.currencyMosaicId === m.id)?.amount || 0;

		if (mosaicInfo[network.currencyMosaicId])
			return balance / (10 ** mosaicInfo[network.currencyMosaicId].divisibility);

		return balance;
	};

	const convertToCurrency = (getXYMMosaic() * price).toFixed(2);

	return (
		<div className='flex flex-col items-center'>
			<div className='text-2xl font-bold'> {getXYMMosaic()} XYM</div>
			<div className='text-2xl text-sub-title'>{convertToCurrency} {symbol.toUpperCase()}</div>
		</div>
	);

};

export default AccountBalance;
