import styles from '@/styles/components/ButtonCopy.module.scss';
import { copyToClipboard } from '@/utils';
import Image from 'next/image';
import { toast } from 'react-toastify';

const ButtonCopy = ({ value, className }) => {
	const copy = () => {
		try {
			copyToClipboard(value);
			toast.success('Copied.');
		} catch {
			alert('Failed to copy!');
		}
	};

	return (
		<div className={`${styles.buttonCopy} ${className}`} onClick={copy}>
			<Image src="/images/icon-copy.png" fill alt="copy" />
		</div>
	);
};

export default ButtonCopy;
