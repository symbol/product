import '@testing-library/jest-dom';
import ValueBlockStatus from '@/app/components/ValueBlockStatus';
import { render, screen } from '@testing-library/react';

const recentBlock = { height: 1000 };
const chainStatusSafe = { height: 2000 }; 
const chainStatusRecent = { height: 1100 };

// next/image rewrites the src to an optimized URL with the original path URL-encoded; decode before asserting.
const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

describe('ValueBlockStatus', () => {
	describe('status resolution', () => {
		const runTest = (config, expectedLabel) => {
			// Act:
			render(<ValueBlockStatus block={recentBlock} chainStatus={config.chainStatus} isPending={config.isPending} />);

			// Assert:
			expect(screen.getByText(expectedLabel)).toBeInTheDocument();
		};

		const testCases = [
			{
				description: 'resolves the safe status for a deeply buried block',
				config: { chainStatus: chainStatusSafe },
				expectedLabel: 'label_safe'
			},
			{
				description: 'resolves the created status for a recent block',
				config: { chainStatus: chainStatusRecent },
				expectedLabel: 'label_created'
			},
			{
				description: 'resolves the created status when the chain status is unknown',
				config: { chainStatus: null },
				expectedLabel: 'label_created'
			}
		];

		testCases.forEach(({ description, config, expectedLabel }) => it(description, () => runTest(config, expectedLabel)));
	});

	describe('rendering modes', () => {
		it('renders a badge with the label text and an icon by default', () => {
			// Act:
			render(<ValueBlockStatus block={recentBlock} chainStatus={chainStatusSafe} />);

			// Assert:
			expect(screen.getByText('label_safe')).toBeInTheDocument();
			expect(screen.getByAltText('safe')).toBeInTheDocument();
		});

		it('renders only the icon, without label text, when isIconOnly', () => {
			// Act:
			render(<ValueBlockStatus block={recentBlock} chainStatus={chainStatusSafe} isIconOnly />);

			// Assert:
			expect(screen.queryByText('label_safe')).not.toBeInTheDocument();
			expect(screen.getByAltText('label_safe')).toBeInTheDocument();
		});
	});

	describe('icon color variant', () => {
		const runTest = (colorVariant, expectedVariantDirectory) => {
			// Arrange:
			const expectedSrc = `/nem/images/status/${expectedVariantDirectory}/icon-label-confirmed.svg`;

			// Act:
			render(<ValueBlockStatus block={recentBlock} chainStatus={chainStatusSafe} isIconOnly colorVariant={colorVariant} />);

			// Assert:
			expect(getIconPath(screen.getByAltText('label_safe'))).toContain(expectedSrc);
		};

		it('defaults to the semantic palette', () => runTest(undefined, 'semantic'));
		it('renders the link color set when requested', () => runTest('link', 'link'));
	});
});
