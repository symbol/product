import '@testing-library/jest-dom';
import StatusIcon from '@/app/components/StatusIcon';
import { render, screen } from '@testing-library/react';

// The suite runs against the 'nem' variant, so asset URLs are prefixed with '/nem'.
const assetBasePath = '/nem/images/status';

// next/image rewrites the src to an optimized URL with the original path URL-encoded; decode before asserting.
const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

describe('StatusIcon', () => {
	describe('icon shape', () => {
		const runTest = (type, expectedShape) => {
			// Arrange:
			const expectedSrc = `${assetBasePath}/semantic/icon-label-${expectedShape}.svg`;

			// Act:
			render(<StatusIcon type={type} />);

			// Assert:
			expect(getIconPath(screen.getByRole('img'))).toContain(expectedSrc);
		};

		const testCases = [
			{ type: 'created', expectedShape: 'true' },
			{ type: 'safe', expectedShape: 'confirmed' },
			{ type: 'confirmed', expectedShape: 'confirmed' },
			{ type: 'finalized', expectedShape: 'confirmed' },
			{ type: 'true', expectedShape: 'true' },
			{ type: 'active', expectedShape: 'true' },
			{ type: 'pending', expectedShape: 'pending' },
			{ type: 'false', expectedShape: 'false' },
			{ type: 'inactive', expectedShape: 'false' },
			{ type: 'harvesting', expectedShape: 'harvesting' },
			{ type: 'multisig', expectedShape: 'multisig' }
		];

		testCases.forEach(({ type, expectedShape }) =>
			it(`renders the '${expectedShape}' icon for the '${type}' token`, () => runTest(type, expectedShape)));
	});

	describe('color variant', () => {
		const runTest = (colorVariant, expectedVariantDirectory) => {
			// Arrange:
			const expectedSrc = `${assetBasePath}/${expectedVariantDirectory}/icon-label-confirmed.svg`;

			// Act:
			render(<StatusIcon type="safe" colorVariant={colorVariant} />);

			// Assert:
			expect(getIconPath(screen.getByRole('img'))).toContain(expectedSrc);
		};

		it('defaults to the semantic palette', () => runTest(undefined, 'semantic'));
		it('renders the body color set', () => runTest('body', 'body'));
		it('renders the link color set', () => runTest('link', 'link'));
	});

	describe('label', () => {
		it('uses the title as the tooltip and the image alt text', () => {
			// Act:
			render(<StatusIcon type="safe" title="label_safe" />);

			// Assert:
			expect(screen.getByAltText('label_safe')).toBeInTheDocument();
			expect(screen.getByTitle('label_safe')).toBeInTheDocument();
		});

		it('falls back to the type as alt text when no title is given', () => {
			// Act:
			render(<StatusIcon type="safe" />);

			// Assert:
			expect(screen.getByAltText('safe')).toBeInTheDocument();
		});
	});
});
