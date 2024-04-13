import { useWalletContext } from '../../context';

const AccountBalance = () => {
	const { walletState } = useWalletContext();
	const { mosaics, currency } = walletState;
	const { symbol, currencyPerXYM } = currency;

	const xymBalance = mosaics.find(m => '10BA3BAA50DEB76C' === m.id)?.amount || 0;
	const convertToCurrency = (xymBalance * currencyPerXYM).toFixed(2);

	return (
		<div className='flex flex-col items-center'>
			<div className='text-2xl font-bold'> {xymBalance} XYM</div>
			<div className='text-2xl text-sub-title'>{convertToCurrency} {symbol}</div>
		</div>
	);

};

export default AccountBalance;
