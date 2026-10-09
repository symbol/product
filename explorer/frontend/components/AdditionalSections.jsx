import Section from '@/app/components/Section';
import { variantComponents } from '@/app/variants/components';
import { memo } from 'react';

/**
 * @typedef AdditionalSection
 * @property {string} component - the variant component name to render (see @/app/variants/components).
 */

/**
 * Renders variant-specific page sections declared in the page config. Each section name is
 * resolved against the active variant's component map; unknown names are skipped.
 * Components can define a synchronous isVisible(props) predicate to skip their Section wrapper.
 * @param {object} props - component props.
 * @param {AdditionalSection[]} props.sections - the sections to render.
 * @param {object} [props.componentProps] - page data passed to each section component.
 * @returns {Array} the rendered sections.
 */
const AdditionalSectionsComponent = ({ sections = [], componentProps = {} }) =>
	sections.map((section, index) => {
		const Component = variantComponents[section.component];

		if (!Component || (Component.isVisible && !Component.isVisible(componentProps)))
			return null;

		return (
			<Section key={index}>
				<Component {...componentProps} />
			</Section>
		);
	});

export const AdditionalSections = memo(AdditionalSectionsComponent);
