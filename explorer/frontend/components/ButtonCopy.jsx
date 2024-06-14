import styles from '@/styles/components/ButtonCopy.module.scss';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import { toast } from 'react-toastify';
import { useCopyToClipboard } from 'usehooks-ts';

const ButtonCopy = ({ value, className }) => {
	const { t } = useTranslation();
	const [, copy] = useCopyToClipboard();

	const handleCopy = async () => {
		try {
			await copy(value);
			toast.success(t('message_copySuccess'));
		} catch {
			toast.error(t('message_copyFailed'));
		}
	};

	return (
		<div className={`${styles.buttonCopy} ${className}`} onClick={handleCopy}>
			<Image src="/images/icon-copy.png" fill alt="Copy" />
		</div>
	);
};

export default ButtonCopy;
