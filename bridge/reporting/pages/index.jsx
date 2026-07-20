import Head from 'next/head';

export const getServerSideProps = async () => {

	return {
		props: {
			bridgeConfigurations: {},
			initialPage: null,
			initialError: ''
		}
	};
};

export const Home = ({ bridgeConfigurations, initialPage, initialError }) => {

	return (
		<div>
			<Head>
				<title>Symbol Bridge Monitor</title>
				<meta content="Monitor Symbol bridge wrap, unwrap, payout, and error records." name="description" />
			</Head>

			<main>
				Monitor pages for the Symbol bridge.
			</main>
		</div>
	);
};

export default Home;
