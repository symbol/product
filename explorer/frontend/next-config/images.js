const commonImageLocalPatterns = [
	{
		pathname: '/images/**'
	}
];

const variantImageLocalPatterns = {
	nem: [
		{
			pathname: '/nem/images/**'
		}
	],
	symbol: [
		{
			pathname: '/symbol/images/**'
		}
	]
};

const getImageLocalPatterns = platform => [
	...commonImageLocalPatterns,
	...(variantImageLocalPatterns[platform] || [])
];

module.exports = {
	getImageLocalPatterns
};
