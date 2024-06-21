import { useWalletContext } from '../../context';
import helper from '../../utils/helper';
import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useState } from 'react';

const AccountCreateModalBox = ({ isOpen, onRequestClose }) => {
	const { walletState, dispatch, symbolSnap } = useWalletContext();
	const { accounts } = walletState;

	const [walletName, setWalletName] = useState('');
	const [error, setError] = useState('');

	const isWalletNameExist = newWalletName => {
		return Object.values(accounts).some(account => account.label.toUpperCase() === newWalletName.toUpperCase());
	};

	const validateWalletName = walletName => {
		if ('' === walletName.trim())
			return 'Wallet name is required';
		if (isWalletNameExist(walletName))
			return 'Wallet name already exists';
	};

	const handleCreateNewAccount = async () => {
		if (error || '' === walletName)
			return;

		await helper.createNewAccount(dispatch, symbolSnap, accounts, walletName);

		setWalletName('');
		onRequestClose(false);
	};

	const handleOnChangeWalletName = newWalletName => {
		setWalletName(newWalletName);
		setError(validateWalletName(newWalletName));
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                        Create Wallet
				</div>

				<Input label='Wallet Name:' placeholder='Wallet Name' value={walletName} onChange={handleOnChangeWalletName} />

				{
					error && <p className='text-red-500 text-xs'>{error}</p>
				}

				<Button className='uppercase bg-secondary m-2' onClick={handleCreateNewAccount}>
                    Create
				</Button>
			</div>
		</ModalBox>
	);
};

export default AccountCreateModalBox;
