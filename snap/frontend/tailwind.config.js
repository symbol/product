const tailwind = {
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./app/**/*.{js,ts,jsx,tsx,mdx}'
	],
	theme: {
		extend: {
			colors: {
				'title': 'var(--title)',
				'sub-title': 'var(--sub-title)',
				'background': 'var(--background)',
				'primary': 'var(--primary)',
				'secondary': 'var(--secondary)',
				'green': 'var(--green)',
			},
		}
	},
	plugins: []
};

export default tailwind;
