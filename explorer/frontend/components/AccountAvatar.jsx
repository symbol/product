import styles from '@/styles/components/AccountAvatar.module.scss';
import hslToRgb from 'hsl-rgb';
import CustomImage from './CustomImage';

const getColorFromHash = (hash) => {
    if (!hash) {
        return '#000';
    }

    const spread = 100;
    const saturation = 0.9;
    const lightness = 0.8;
	const numbers = [...Array(10).keys()];
	const alphabet = Array.from(Array(26)).map((e, i) => i + 65).map((x) => String.fromCharCode(x));
    const charset = [...numbers, ...alphabet];

    let totalValue = 0;

    for (const char of hash) totalValue += charset.indexOf(char.toUpperCase());

    const k = Math.trunc(totalValue / spread);
    const offsetValue = totalValue - spread * k;
    const hue = offsetValue / 100;

    const color = hslToRgb(hue * 360, saturation, lightness);

    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

const AccountAvatar = ({ address, size }) => {
	let rootStyle;

	switch (size) {
        default:
        case 'sm':
            rootStyle = styles.containerSm;
            break;
        case 'md':
            rootStyle = styles.containerMd;
            break;
        case 'lg':
            rootStyle = styles.containerLg;
            break;
    }

	const getImage = () => {
        let src;
        const addressSecondChar = address[1].toUpperCase();

        switch (addressSecondChar) {
            default:
            case 'A':
                src = '/images/avatars/avatar-1.png';
                break;
            case 'B':
                src = '/images/avatars/avatar-2.png';
                break;
            case 'C':
                src = '/images/avatars/avatar-3.png';
                break;
            case 'D':
                src = '/images/avatars/avatar-4.png';
                break;
        }

        return {
			src,
			style: {
				backgroundColor: getColorFromHash(address),
			}
		};
    };

	const image = address ? getImage() : { src: '/images/icon-question.png' };

	return (
		<div className={`${styles.container} ${rootStyle}`}>
			<CustomImage src={image.src} className={styles.image} style={image.style} />
		</div>
	)
}

export default AccountAvatar;
