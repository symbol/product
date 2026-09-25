import config from '@/config';
import { Head, Html, Main, NextScript } from 'next/document';

const Document = () => (
	<Html lang="en">
		<Head>
			<meta content="#160820" name="theme-color" />
			<script dangerouslySetInnerHTML={{ __html: `window.appConfig = ${JSON.stringify(config).replace(/</g, '\\u003c')};` }} />
		</Head>
		<body>
			<Main />
			<NextScript />
		</body>
	</Html>
);

export default Document;
