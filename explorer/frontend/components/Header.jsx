import styles from '@/styles/components/Header.module.scss';
import Image from 'next/image';
import Link from 'next/link';

const menuItems = [
	{
		text: 'Home',
		href: '/'
	},
	{
		text: 'Blocks',
		href: '/blocks'
	}
];

const Header = () => (
	<div className={styles.headerWrapper}>
		<header className={styles.header}>
			<div className={styles.headerLogo}>
				<Image src="/images/logo-nem.png" fill alt="NEM" />
			</div>
			<div className={styles.headerMenu}>
				{menuItems.map((item, index) => (
					<Link className={styles.headerMenuItem} key={index} href={item.href}>
						{item.text}
					</Link>
				))}
			</div>
		</header>
	</div>
);

export default Header;
