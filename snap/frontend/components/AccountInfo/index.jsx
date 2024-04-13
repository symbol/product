import { useWalletContext } from '../../context';
import Image from 'next/image';

const AccountInfo = () => {
	const { walletState } = useWalletContext();
	const { selectedAccount } = walletState;
	const { address, label } = selectedAccount;

	return (
		selectedAccount && <div className='flex flex-col items-center justify-center p-2'>
			<div className="rounded-full w-16 h-16 bg-gray-300" />
			{/* Text Address and wallet label */}
			<div className='flex flex-col items-center text-xs'>
				<div className='flex items-center pt-2 justify-center'>
					<div className='truncate md:w-2/3 w-1/2'>{address}</div>
					<Image
						src='/copy-icon.svg'
						width={18}
						height={18}
						alt='Copy logo'
					/>
				</div>

				<div className='truncate md:w-2/3 w-1/2 justify-center flex'>{label}</div>
			</div>
		</div>
	);
};

export default AccountInfo;
