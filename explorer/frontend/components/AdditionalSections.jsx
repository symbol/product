import Section from '@/components/Section';
import config from '@/config';
import dynamic from 'next/dynamic';
import { memo } from 'react';

export const AdditionalSections = memo(({ sections }) => {
    return sections.map((section, index) => {
        const Component = dynamic(() =>
            import(`@/_variants/${config.PLATFORM}/components/${section.component}.jsx`)
        );

        return (
            <Section key={index}>
                <Component />
            </Section>
        );

    })
})
