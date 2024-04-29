import Button from '../Button';
import ModalBox from '../ModalBox';

const AccountListModalBox = ({ accounts, isOpen, onRequestClose }) => {
	const renderAccount = account => {
		return (
			<div key={`wallet_${account.id}`} className='flex items-center'>
				<div className="rounded-full w-10 h-10 bg-gray-300"/>
				<div className='flex flex-col items-start justify-center p-2'>
					<div className='font-bold'>{account.label}</div>
					<div className='truncate w-[180px]'>{account.address}</div>
				</div>
			</div>
		);

	};
	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                    Wallet
				</div>

				<div className='flex items-center justify-start mb-6 text-xs'>
					{
						Object.keys(accounts).map(key => renderAccount(accounts[key]))
					}
				</div>

				<div className='flex justify-center font-bold pt-2'>
					<Button className='uppercase w-40 h-10 bg-secondary m-2'>
                        Create
					</Button>
					<Button className='uppercase w-40 h-10 bg-secondary m-2'>
                        Import
					</Button>
				</div>
			</div>
		</ModalBox>
	);
};

export default AccountListModalBox;
