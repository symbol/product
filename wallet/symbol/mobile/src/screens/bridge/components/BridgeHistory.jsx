import { ItemSwapRequest } from '@/app/screens/bridge/components/ItemSwapRequest';
import { colors } from '@/app/styles';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/**
 * Component that renders a single transaction item in a list.
 * @param {object} props - The component props.
 * @param {import('wallet-common-core/src/types/Bridge').BridgeRequest[]} props.history - The transaction object to display.
 * @param {boolean} props.isLoading - Loading state
 */
export const BridgeHistory = ({ history, isLoading }) => {
    const isSpinnerShown = isLoading && history.length === 0;

    return (
        <View>
            {history.map(item => (
                <ItemSwapRequest key={item.requestTransaction.hash} request={item} />
            ))}
            {isSpinnerShown && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
        </View>
    );
};


const styles = StyleSheet.create({
    loadingIndicator: {
        position: 'absolute',
        height: '100%',
        width: '100%'
    },
});
