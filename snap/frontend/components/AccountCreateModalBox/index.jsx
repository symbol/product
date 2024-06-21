import { useWalletContext } from '../../context';
import helper from '../../utils/helper';
import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useState } from 'react';

const AccountCreateModalBox = ({ isOpen, onRequestClose }) => {
	const { walletState, dispatch, symbolSnap } = useWalletContext();
	const { accounts } = walletState;

	const [accountName, setAccountName] = useState('');
	const [error, setError] = useState('');

	const isAccountNameExist = newAccountName => {
		return Object.values(accounts).some(account => account.label.toUpperCase() === newAccountName.toUpperCase());
	};

	const validateAccountName = accountName => {
		if ('' === accountName.trim())
			return 'Account name is required';
		if (isAccountNameExist(accountName))
			return 'Account name already exists';
	};

	const handleCreateNewAccount = async () => {
		if (error || '' === accountName)
			return;

		await helper.createNewAccount(dispatch, symbolSnap, accounts, accountName);

		setAccountName('');
		onRequestClose(false);
	};

	const handleOnChangeAccountName = newAccountName => {
		setAccountName(newAccountName);
		setError(validateAccountName(newAccountName));
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                        Create Account
				</div>

				<Input label='Account Name:' placeholder='Account Name' value={accountName} onChange={handleOnChangeAccountName} />

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
