describe('variant DocumentHead', () => {
	it('renders the NEM document metadata and font links', () => {
		// Arrange:
		const { DocumentHead } = require('@/variants/nem/DocumentHead');

		// Act:
		const result = DocumentHead();
		const { children } = result.props;

		// Assert:
		expect(children).toEqual(expect.arrayContaining([
			expect.objectContaining({ props: expect.objectContaining({ name: 'description', content: 'NEM Block Explorer' }) }),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'icon', href: '/favicon.ico' }) }),
			expect.objectContaining({
				props: expect.objectContaining({
					rel: 'stylesheet',
					href: expect.stringContaining('Nunito+Sans')
				})
			}),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'stylesheet', href: expect.stringContaining('PT+Serif') }) })
		]));
	});

	it('renders the Symbol document metadata and manifest links', () => {
		// Arrange:
		const { DocumentHead } = require('@/variants/symbol/DocumentHead');

		// Act:
		const result = DocumentHead();
		const { children } = result.props;

		// Assert:
		expect(children).toEqual(expect.arrayContaining([
			expect.objectContaining({ props: expect.objectContaining({ name: 'description', content: 'Symbol Block Explorer' }) }),
			expect.objectContaining({ props: expect.objectContaining({ name: 'theme-color', content: '#1B0A29' }) })
		]));
	});
});
