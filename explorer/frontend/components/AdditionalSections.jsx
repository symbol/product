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
 * @param {object} props - component props.
 * @param {AdditionalSection[]} props.sections - the sections to render.
 * @returns {Array} the rendered sections.
 */
const AdditionalSectionsComponent = ({ sections = [] }) =>
	sections.map((section, index) => {
		const Component = variantComponents[section.component];

		if (!Component)
			return null;

		return (
			<Section key={index}>
				<Component />
			</Section>
		);
	});

export const AdditionalSections = memo(AdditionalSectionsComponent);
