import { AdditionalSections } from '@/app/components/AdditionalSections';
import { variantComponents } from '@/app/variants/components';
import { render, screen } from '@testing-library/react';

jest.mock('@/app/components/Section', () => ({
	__esModule: true,
	default: ({ children }) => <section data-testid="section">{children}</section>
}));

jest.mock('@/app/variants/components', () => {
	const ConditionalSection = jest.fn();
	ConditionalSection.isVisible = jest.fn();

	return {
		__esModule: true,
		variantComponents: {
			FirstSection: jest.fn(),
			SecondSection: jest.fn(),
			ConditionalSection
		}
	};
});

const { FirstSection, SecondSection, ConditionalSection } = variantComponents;

describe('AdditionalSections', () => {
	beforeEach(() => {
		FirstSection.mockImplementation(() => <div>First section</div>);
		SecondSection.mockImplementation(() => <div>Second section</div>);
		ConditionalSection.mockImplementation(() => <div>Conditional section</div>);
	});

	it('renders nothing when no sections are configured', () => {
		// Act:
		const { container } = render(<AdditionalSections />);

		// Assert:
		expect(container).toBeEmptyDOMElement();
	});

	it('skips unknown components without creating a wrapper', () => {
		// Act:
		const { container } = render(<AdditionalSections sections={[{ component: 'UnknownSection' }]} />);

		// Assert:
		expect(container).toBeEmptyDOMElement();
	});

	it('renders configured components in order with one wrapper each', () => {
		// Arrange: use a different order from the component registry.
		const sections = [{ component: 'SecondSection' }, { component: 'FirstSection' }];

		// Act:
		render(<AdditionalSections sections={sections} />);

		// Assert:
		expect(screen.getAllByTestId('section').map(section => section.textContent))
			.toEqual(['Second section', 'First section']);
	});

	it('passes componentProps to each configured component', () => {
		// Arrange:
		const sections = [{ component: 'FirstSection' }, { component: 'SecondSection' }];
		const componentProps = { message: 'Shared page data', count: 7 };

		// Act:
		render(<AdditionalSections sections={sections} componentProps={componentProps} />);

		// Assert:
		expect(FirstSection.mock.calls[0][0]).toEqual(componentProps);
		expect(SecondSection.mock.calls[0][0]).toEqual(componentProps);
	});

	it('renders components without isVisible and defaults componentProps to an empty object', () => {
		// Act:
		render(<AdditionalSections sections={[{ component: 'FirstSection' }]} />);

		// Assert:
		expect(screen.getByTestId('section')).toHaveTextContent('First section');
		expect(FirstSection.mock.calls[0][0]).toEqual({});
	});

	it('renders the component when isVisible returns true', () => {
		// Arrange:
		const sections = [{ component: 'ConditionalSection' }];
		ConditionalSection.isVisible.mockReturnValue(true);

		// Act:
		render(<AdditionalSections sections={sections} />);

		// Assert:
		expect(screen.getByText('Conditional section')).toBeInTheDocument();
	});

	it('does not render the component when isVisible returns false', () => {
		// Arrange:
		const sections = [{ component: 'ConditionalSection' }];
		ConditionalSection.isVisible.mockReturnValue(false);

		// Act:
		render(<AdditionalSections sections={sections} />);

		// Assert:
		expect(screen.queryByText('Conditional section')).not.toBeInTheDocument();
	});
});
