/* eslint-disable @next/next/no-document-import-in-page */
import { Head, Html, Main, NextScript } from 'next/document';
import { DocumentHead } from '@/_variants';

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
