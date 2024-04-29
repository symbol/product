import { useWalletContext } from '../../context';
import AccountListModalBox from '../AccountListModalBox';
import Address from '../Address';
import { useState } from 'react';

const AccountInfo = () => {
	const { walletState } = useWalletContext();
	const { accounts, selectedAccount } = walletState;

	const [ isOpenAccountListModalBox, setOpenAccountListModalBox ] = useState(false);

	const handleAccountListModalBox = () => {
		setOpenAccountListModalBox(!isOpenAccountListModalBox);
	};

	return (
		<>
			<AccountListModalBox accounts={accounts} isOpen={isOpenAccountListModalBox} onRequestClose={setOpenAccountListModalBox} />

			<div className='flex flex-col items-center justify-center p-2'>
				<div role='profile-image' className="rounded-full w-16 h-16 bg-gray-300" onClick={handleAccountListModalBox}/>
				{/* Text Address and wallet label */}
				<Address account={selectedAccount} />
			</div>
		</>
	);
};

export default AccountInfo;
