import './globals.css';

export const metadata = {
	title: 'Symbol Snap',
	description: 'Symbol wallet in metamask'
};

export default function RootLayout({ children }) {
	return (
		<html lang="en" className='dark'>
			<body>
				{children}
			</body>
		</html>
	);
}
