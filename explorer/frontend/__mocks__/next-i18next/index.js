export const useTranslation = () => ({
	t: (key, options) => {
		const optionEntries = Object.entries(options || {});

		return 0 === optionEntries.length
			? key
			: `${key}::${optionEntries.map(([name, value]) => `${name}:${value}`).join(',')}`;
	}
});
