import Image from 'next/image';
import { useState } from 'react';

const Address = ({ account }) => {
	const [copySuccess, setCopySuccess] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(account.address);
		setCopySuccess(true);
		setTimeout(() => setCopySuccess(false), 2000);
	};

	return (
		<div className='flex flex-col items-center text-xs'>
			<div className='flex items-center pt-2 justify-center'>
				<div className='truncate md:w-2/3 w-1/2'>{account.address}</div>
				<Image
					className='cursor-pointer'
					src='/copy-icon.svg'
					width={18}
					height={18}
					alt='Copy logo'
					onClick={copyToClipboard}
				/>
			</div>

			<div className='truncate md:w-2/3 w-1/2 justify-center flex'>{account.label}</div>

			{copySuccess && <p className='text-green'>Copied to clipboard!</p>}
		</div>
	);

};

export default Address;
