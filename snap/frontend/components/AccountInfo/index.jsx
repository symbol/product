import { useWalletContext } from '../../context';
import Address from '../Address';

const AccountInfo = () => {
	const { walletState } = useWalletContext();
	const { selectedAccount } = walletState;

	return (
		selectedAccount && <div className='flex flex-col items-center justify-center p-2'>
			<div role='profile-image' className="rounded-full w-16 h-16 bg-gray-300" />
			{/* Text Address and wallet label */}
			<Address account={selectedAccount} />
		</div>
	);
};

export default AccountInfo;
