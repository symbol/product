export const DocumentHead = () => (
	<>
		<meta charSet="utf-8" />
		<link rel="icon" href="/symbol/favicon.ico" />
		<meta name="format-detection" content="telephone=no" />
		<meta name="theme-color" content="#1b0a29" />
		<meta name="description" content="Symbol Block Explorer" />
		<link rel="apple-touch-icon" href="/symbol/logo192.png" />
		<link rel="manifest" href="/symbol/manifest.json" />
		<link rel="preload" href="/symbol/fonts/Protipo-Regular.otf" as="font" type="font/otf" crossOrigin="anonymous" />
		<link
			rel="preload"
			href="/symbol/fonts/SofiaSansCondensed-ExtraBold.ttf"
			as="font"
			type="font/ttf"
			crossOrigin="anonymous"
		/>
		{/* Static link required because Turbopack cannot resolve a variant-specific sass import here. */}
		{/* eslint-disable-next-line @next/next/no-css-tags */}
		<link rel="stylesheet" href="/symbol/fonts/fonts.css" />
	</>
);
