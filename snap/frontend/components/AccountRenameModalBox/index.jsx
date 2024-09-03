import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useEffect, useState } from 'react';

const AccountRenameModalBox = ({ isOpen, onRequestClose, onRename, currentName, validateAccountName }) => {
	const [newName, setNewName] = useState(currentName);
	const [error, setError] = useState('');

	// Reset newName and error when the modal opens
	useEffect(() => {
		if (isOpen) {
			setNewName(currentName);
			setError('');
		}
	}, [isOpen, currentName]);

	const handleSubmit = () => {
		const validationError = validateAccountName(newName);
		if (validationError) {
			setError(validationError);
		} else {
			onRename(newName);
			onRequestClose();
		}
	};

	const handleInputChange = e => {
		setNewName(e.target.value);
		setError('');
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>Rename Account</div>
				<Input
					value={newName}
					onChange={handleInputChange}
					placeholder='New Account Name'
					errorMessage={error}
					className='mb-4'
				/>
				<div className='flex justify-center'>
					<Button className='uppercase w-40 h-10 bg-secondary m-2' onClick={handleSubmit}>
            Rename
					</Button>
					<Button className='uppercase w-40 h-10 bg-secondary m-2' onClick={onRequestClose}>
            Cancel
					</Button>
				</div>
			</div>
		</ModalBox>
	);
};

export default AccountRenameModalBox;
