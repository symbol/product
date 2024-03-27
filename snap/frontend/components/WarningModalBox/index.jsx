import Button from '../Button';
import ModalBox from '../ModalBox';
import Image from 'next/image';

const WarningModalBox = ({ children, isOpen, onRequestClose, title, description }) => {
	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className="flex items-center justify-center mb-6">
					<Image
						src='/symbol-logo.svg'
						width={150}
						height={50}
						alt='Symbol logo'
					/>
				</div>

				<div className='text-2xl font-bold mb-6'>
					{title}
				</div>
				<div className='text-sm mb-6'>
					{description}
				</div>
				<Button icon='./metamask-icon.svg'>
					{ children }
				</Button>

			</div>
		</ModalBox>
	);
};

export default WarningModalBox;
