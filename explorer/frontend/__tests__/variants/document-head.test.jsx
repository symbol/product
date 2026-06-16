import { DocumentHead as NemDocumentHead } from '@/variants/nem/DocumentHead';
import { DocumentHead as SymbolDocumentHead } from '@/variants/symbol/DocumentHead';

describe('variant DocumentHead', () => {
	it('renders the NEM document metadata and font links', () => {
		// Act:
		const result = NemDocumentHead();
		const { children } = result.props;

		// Assert:
		expect(children).toEqual(expect.arrayContaining([
			expect.objectContaining({ props: expect.objectContaining({ name: 'description', content: 'NEM Block Explorer' }) }),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'icon', href: '/nem/favicon.ico' }) }),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'apple-touch-icon', href: '/nem/images/logo192.png' }) }),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'manifest', href: '/nem/manifest.json' }) }),
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
		// Act:
		const result = SymbolDocumentHead();
		const { children } = result.props;

		// Assert:
		expect(children).toEqual(expect.arrayContaining([
			expect.objectContaining({ props: expect.objectContaining({ name: 'description', content: 'Symbol Block Explorer' }) }),
			expect.objectContaining({ props: expect.objectContaining({ name: 'theme-color', content: '#1B0A29' }) }),
			expect.objectContaining({
				props: expect.objectContaining({ rel: 'icon', href: '/symbol/favicon.ico' })
			}),
			expect.objectContaining({
				props: expect.objectContaining({ rel: 'apple-touch-icon', href: '/symbol/images/icon-symbol-192.png' })
			}),
			expect.objectContaining({ props: expect.objectContaining({ rel: 'manifest', href: '/symbol/manifest.json' }) })
		]));
	});
});
