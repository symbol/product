import styles from '@/app/styles/components/CustomImage.module.scss';
import Image from 'next/image';

const CustomImage = ({ alt, src, className, style, title, onClick }) => (
	<div className={`${styles.image} ${className}`} style={style} title={title} onClick={onClick}>
		<Image src={src} fill alt={alt} />
	</div>
);

export default CustomImage;
