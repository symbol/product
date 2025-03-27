// import Clipboard from '@react-native-community/clipboard';
// Remove after fix https://github.com/react-native-clipboard/clipboard/issues/71
import { AppError } from '@/app/lib/error';
import { Clipboard, PermissionsAndroid, Platform, Vibration } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';

const requestAndroidWritePermission = async () => {
    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const isPermissionAlreadyGranted = await PermissionsAndroid.check(permission);

    if (isPermissionAlreadyGranted) {
        return true;
    }

    let isPermissionGranted;

    try {
        const result = await PermissionsAndroid.request(permission);
        isPermissionGranted = result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
        isPermissionGranted = false;
    }

    return isPermissionGranted;
};

export class PlatformUtils {
    /**
     * Copies the given string to the clipboard.
     * @param {string} str - The string to be copied to the clipboard.
     */
    static copyToClipboard(str) {
        Clipboard.setString(str);
    }

    /**
     * Retrieves the operating system of the platform.
     * @returns {'android' | 'ios'} The operating system id.
     */
    static getOS() {
        return Platform.OS;
    }

    /**
     * Triggers a vibration on the device.
     * Only works on Android.
     */
    static vibrate() {
        if (PlatformUtils.getOS() === 'android') {
            Vibration.vibrate(2);
        }
    }

    /**
     * Writes the given data to a file.
     * @param {string} data - The data to be written to the file.
     * @param {string} filename - The name of the file.
     * @param {string} encoding - The encoding of the file.
     * @returns {Promise<boolean>} A promise that resolves to true if the file was written successfully.
     */
    static async writeFile(data, filename, encoding) {
        const { dirs } = RNFetchBlob.fs;
        const destinationDirectory = PlatformUtils.getOS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
        const path = `${destinationDirectory}/${filename}`;

        await PlatformUtils.requestWritePermission();

        try {
            await RNFetchBlob.fs.writeFile(path, data, encoding);

            if (Platform.OS === 'ios') {
                RNFetchBlob.ios.previewDocument(path);
            }
        } catch (error) {
            throw new AppError('error_failed_write_file', error.message);
        }

        return true;
    }

    /**
     * Requests the necessary permissions to write to the device storage.
     * @returns {Promise<boolean>} A promise that resolves to true if the permission was granted.
     */
    static async requestWritePermission() {
        if (Platform.OS === 'android') {
            return requestAndroidWritePermission();
        }

        return true;
    }
}
