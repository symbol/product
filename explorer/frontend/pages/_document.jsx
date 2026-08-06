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
				{/* Overrides the configuration `_app` inlined at render time with the container's runtime
				    values. Must stay free of `defer`: every Next.js bundle is deferred, so this runs first
				    and `window.appConfig` is correct before any application module reads it. */}
				<script src="/runtime-config.js" />
				<NextScript />
			</body>
		</Html>
	);
}
