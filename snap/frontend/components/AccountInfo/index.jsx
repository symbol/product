import { useWalletContext } from '../../context';
import AccountListModalBox from '../AccountListModalBox';
import Address from '../Address';
import makeBlockie from 'ethereum-blockies-base64';
import Image from 'next/image';
import { useState } from 'react';

const AccountInfo = () => {
	const { walletState } = useWalletContext();
	const { selectedAccount } = walletState;
	const { address } = selectedAccount;

	const [ accountListModalBoxVisible, setAccountListModalBoxVisible ] = useState(false);

	const handleAccountListModalBox = () => {
		setAccountListModalBoxVisible(!accountListModalBoxVisible);
	};

	return (
		<>
			<AccountListModalBox isOpen={accountListModalBoxVisible} onRequestClose={setAccountListModalBoxVisible} />

			<div className='flex flex-col items-center justify-center p-2'>

				{/* Account Profile */}
				{ address &&
					<Image src={makeBlockie(address)}
						alt='account-profile'
						width={24}
						height={24}
						className='rounded-full w-16 h-16'
						onClick={handleAccountListModalBox} />
				}

				{/* Text Address and wallet label */}
				<Address account={selectedAccount} />
			</div>
		</>
	);
};

export default AccountInfo;
