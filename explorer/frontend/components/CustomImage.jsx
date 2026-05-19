import styles from '@/styles/components/CustomImage.module.scss';
import { createAssetURL } from '@/utils';
import Image from 'next/image';

const CustomImage = ({ alt, src, className, style, onClick }) => (
	<div className={`${styles.image} ${className}`} style={style} onClick={onClick}>
		<Image src={src?.startsWith('/images/') ? createAssetURL(src) : src} fill alt={alt} />
	</div>
);

export default CustomImage;
