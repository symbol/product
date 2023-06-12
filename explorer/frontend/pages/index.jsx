import Field from '@/components/Field';
import FieldPrice from '@/components/FieldPrice';
import Section from '@/components/Section';
import styles from '@/styles/pages/Home.module.scss';
import Head from 'next/head';

const Home = () => (
	<div className={styles.wrapper}>
		<Head>
			<title>Home</title>
		</Head>
		<Section title="Base Info">
			<Field title="Price">
				<FieldPrice value={5.17} change={13} />
			</Field>
		</Section>
	</div>
);

export default Home;
