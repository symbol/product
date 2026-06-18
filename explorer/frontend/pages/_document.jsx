import { DocumentHead } from '@/app/variants/document';
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html>
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
