import '@testing-library/jest-dom';
import ItemBlockMobile from '@/app/components/ItemBlockMobile';
import { render, screen } from '@testing-library/react';

const block = {
	height: 1000,
	harvester: 'harvester-account-address',
	timestamp: '2024-03-30 01:06:25',
	totalFee: 0
};
const chainStatusSafe = { height: 2000 };
const chainStatusRecent = { height: 1100 };

// next/image rewrites the src to an optimized URL with the original path URL-encoded; decode before asserting.
const getIconPath = image => decodeURIComponent(image.getAttribute('src'));

describe('ItemBlockMobile', () => {
	it('links the height to the block page', () => {
		// Act:
		render(<ItemBlockMobile data={block} chainStatus={chainStatusSafe} />);

		// Assert:
		expect(screen.getByText('1000').closest('a')).toHaveAttribute('href', '/blocks/1000');
	});

	describe('finality status icon', () => {
		const runTest = (chainStatus, expectedLabel, expectedShape) => {
			// Arrange:
			const expectedSrc = `/nem/images/status/link/icon-label-${expectedShape}.svg`;

			// Act:
			render(<ItemBlockMobile data={block} chainStatus={chainStatus} />);

			// Assert:
			expect(getIconPath(screen.getByAltText(expectedLabel))).toContain(expectedSrc);
		};

		it('renders the safe status as a link-colored icon', () => runTest(chainStatusSafe, 'label_safe', 'confirmed'));
		it('renders the created status as a link-colored icon', () => runTest(chainStatusRecent, 'label_created', 'true'));
	});
});
