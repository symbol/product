export const metadata = {
	title: process.env.NEXT_PUBLIC_META_TITLE,
	description: process.env.NEXT_PUBLIC_META_DESCRIPTION
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
