import { navigationRef } from '@/app/router/navigationRef';
import { useEffect, useState } from 'react';

export const useCurrentRoute = () => {
	const [currentRouteName, setCurrentRouteName] = useState(null);
    
	useEffect(() => {
		const updateRouteName = () => {
			if (!navigationRef.current)
				return;

			const newRoute = navigationRef.current.getCurrentRoute();
            
			if (newRoute && newRoute.name !== currentRouteName)
				setCurrentRouteName(newRoute.name);
		};
		updateRouteName();

		navigationRef.current?.addListener('state', () => updateRouteName());
        
		return () => {
			navigationRef.current?.removeListener('state', () => updateRouteName());
		};
	}, [navigationRef.current]);

	return currentRouteName;
};
