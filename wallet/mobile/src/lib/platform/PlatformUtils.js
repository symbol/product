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

    if (!isPermissionGranted) {
        throw new AppError('error_permission_denied_write_storage', 'Permission denied to write to device storage');
    }

    return true;
};

export class PlatformUtils {
    static copyToClipboard(str) {
        Clipboard.setString(str);
    }

    static getOS() {
        return Platform.OS;
    }

    static vibrate() {
        if (PlatformUtils.getOS() === 'android') {
            Vibration.vibrate(2);
        }
    }

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

    static async requestWritePermission() {
        if (Platform.OS === 'android') {
            return requestAndroidWritePermission();
        }

        return true;
    }
}
