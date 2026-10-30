import NativeSplashScreen from 'specs/NativeSplashScreen';

/**
 * Hides the native splash screen. Only works on Android.
 */
export const hideSplashScreen = () => {
	NativeSplashScreen?.hide();
};
