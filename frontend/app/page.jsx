'use client';

import dynamic from 'next/dynamic';

const HomeComponent = dynamic(() => {
	switch(process.env.NEXT_PUBLIC_BUILD_TARGET) {
	case 'nem':
		return import('../components/nem/pages/Home');
	case 'symbol':
		return import('../components/symbol/pages/Home');
	default:
		throw new Error('The build target is not specified');
	}
}, {
	ssr: false
});

export default function Home() {
	return (
		<HomeComponent />
	);
}
