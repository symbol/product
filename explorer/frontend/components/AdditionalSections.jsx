import Section from '@/components/Section';
import config from '@/config';
import dynamic from 'next/dynamic';
import { memo } from 'react';

const AdditionalSections = ({ sections = [] }) => (
	<>
		{sections.map(section => {
			const Component = dynamic(() => import(`@/variants/${config.PLATFORM}/components/${section.component}.jsx`));

			return (
				<Section key={section.component}>
					<Component />
				</Section>
			);
		})}
	</>
);

export default memo(AdditionalSections);
