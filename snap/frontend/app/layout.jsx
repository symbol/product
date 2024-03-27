import './globals.css';
import React from 'react';

export const metadata = {
	title: 'Symbol Snap',
	description: 'Symbol wallet in metamask'
};

/**
 * Root layout component.
 * @param {children} children - The children component to render.
 * @returns {React.JSX} The root layout component.
 */
export default function RootLayout({ children }) {
	return (
		<html lang="en" className='dark'>
			<body>
				{children}
			</body>
		</html>
	);
}
