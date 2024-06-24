import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useState } from 'react';

const AccountCreationFormModalBox = ({
	isOpen, onRequestClose, title, onSubmit, inputs
}) => {

	const [formData, setFormData] = useState({});

	const handleSubmit = async () => {
		const hasError = inputs.some(input => input.validate && null !== input.validate(formData[input.field]));

		if (hasError)
			return;

		await onSubmit(formData);
		setFormData({});
		onRequestClose(false);
	};

	const handleChange = (field, value) => {
		setFormData(prev => ({ ...prev, [field]: value }));
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
					{title}
				</div>

				{
					inputs.map((input, index) => (
						<Input
							key={index}
							label={input.label}
							placeholder={input.placeholder}
							value={formData[input.field] || ''}
							onChange={e => handleChange(input.field, e.target.value)}
							errorMessage={formData[input.field] && input.validate && input.validate(formData[input.field])}
						/>
					))
				}

				<Button className='uppercase bg-secondary m-2' onClick={handleSubmit}>
                    Submit
				</Button>
			</div>
		</ModalBox>
	);

};

export default AccountCreationFormModalBox;
