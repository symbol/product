import '@testing-library/jest-dom';
import ValueBlockHeightWithStatus from '@/app/components/ValueBlockHeightWithStatus';
import { render, screen } from '@testing-library/react';

const block = { height: 1000 };
const chainStatusSafe = { height: 2000 };

// next/image rewrites the src to an optimized URL with the original path URL-encoded; decode before asserting.
const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

describe('ValueBlockHeightWithStatus', () => {
	it('links the height to the block page', () => {
		// Act:
		render(<ValueBlockHeightWithStatus block={block} chainStatus={chainStatusSafe} />);

		// Assert:
		expect(screen.getByText('1000').closest('a')).toHaveAttribute('href', '/blocks/1000');
	});

	it('renders the finality status as a body text colored icon next to the height', () => {
		// Arrange:
		const expectedSrc = '/nem/images/status/body/icon-label-confirmed.svg';

		// Act:
		render(<ValueBlockHeightWithStatus block={block} chainStatus={chainStatusSafe} />);

		// Assert:
		expect(getIconPath(screen.getByAltText('label_safe'))).toContain(expectedSrc);
	});
});
