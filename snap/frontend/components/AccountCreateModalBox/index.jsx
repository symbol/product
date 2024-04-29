import { useWalletContext } from '../../context';
import dispatchHelper from '../../utils/dispatchHelper';
import helper from '../../utils/helper';
import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useCallback, useState } from 'react';

const AccountCreateModalBox = ({ isOpen, onRequestClose }) => {
	const { walletState, dispatch } = useWalletContext();
	const { accounts } = walletState;
	const actionDispatchers = dispatchHelper(dispatch);

	const [walletName, setWalletName] = useState('');
	const [isError, setError] = useState(false);

	const isWalletNameExist = useCallback(
		newWalletName => Object.values(accounts).some(account => account.label.toUpperCase() === newWalletName.toUpperCase()),
		[accounts]
	);

	const handleCreateNewAccount = useCallback(async () => {
		if (isError)
			return;

		const newAccountId = await helper.createAccount(actionDispatchers, accounts, walletName);
		actionDispatchers.setSelectedAccount(newAccountId);
		setWalletName('');
		onRequestClose(false);
	}, [isError, accounts, walletName, actionDispatchers, onRequestClose]);

	const handleOnChangeWalletName = useCallback(event => {
		const newWalletName = event.target.value;
		setWalletName(newWalletName);
		setError(isWalletNameExist(newWalletName));
	}, [isWalletNameExist]);

	const defaultLabel = `Wallet ${helper.getNewMetamaskWalletIndex(accounts) + 1}`;

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                        Create Wallet
				</div>

				<Input label='Wallet Name:' placeholder={defaultLabel} value={walletName} onChange={handleOnChangeWalletName} />

				{
					isError && <p className='text-red-500 text-xs'>This account name already exists</p>
				}

				<Button className='uppercase bg-secondary m-2' onClick={handleCreateNewAccount}>
                    Create
				</Button>
			</div>
		</ModalBox>
	);
};

export default AccountCreateModalBox;
