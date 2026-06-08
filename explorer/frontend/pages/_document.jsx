import config from '@/config';
import { DocumentHead } from '@/variants';
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html data-platform={config.PLATFORM}>
			<Head>
				<DocumentHead />
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
