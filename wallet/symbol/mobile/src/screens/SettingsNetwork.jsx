import { Dropdown, FormItem, Screen, StyledText, TableView, Widget } from '@/app/components';
import { config } from '@/app/config';
import { NetworkIdentifier } from '@/app/constants';
import { useDataManager, useProp, useWalletController } from '@/app/hooks';
import { api } from '@/app/lib/api';
import { $t } from '@/app/localization';
import { colors } from '@/app/styles';
import { handleError } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { createNetworkMap } from 'wallet-common-core';

export const SettingsNetwork = () => {
	const WalletController = useWalletController();
	const { networkProperties, networkIdentifier, selectedNodeUrl, isNetworkConnectionReady } = WalletController;
	const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useProp(networkIdentifier, networkIdentifier);
	const [nodeUrls, setNodeUrls] = useState(createNetworkMap(() => [], config.networkIdentifiers));
	const isConnectingToNode = !isNetworkConnectionReady;

	const getTableValueNullable = value => value === null ? '-' : value;
	const networkInfoTable = {
		network: getTableValueNullable(networkProperties.networkIdentifier),
		nodeUrl: getTableValueNullable(networkProperties.nodeUrl),
		chainHeight: getTableValueNullable(networkProperties.chainHeight),
		minFeeMultiplier: getTableValueNullable(networkProperties.transactionFees.minFeeMultiplier)
	};
	const tableStyle = isConnectingToNode ? { opacity: 0.25 } : null;

	const networkIdentifierOptions = [
		{
			label: $t('s_settings_networkType_mainnet'),
			value: NetworkIdentifier.MAIN_NET
		},
		{
			label: $t('s_settings_networkType_testnet'),
			value: NetworkIdentifier.TEST_NET
		}
	];
	const nodeOptions = [
		{
			label: $t('s_settings_node_automatically'),
			value: null
		},
		...nodeUrls[selectedNetworkIdentifier].map(nodeUrl => ({
			label: nodeUrl,
			value: nodeUrl
		}))
	];

	const [saveChanges, isSavingChanges] = useDataManager(
		async (networkIdentifier, nodeUrl) => {
			await WalletController.selectNetwork(networkIdentifier, nodeUrl);
		},
		null,
		handleError
	);
	const selectNetwork = async networkIdentifier => {
		setSelectedNetworkIdentifier(networkIdentifier);
		saveChanges(networkIdentifier, null);
	};
	const selectNode = async nodeUrl => {
		saveChanges(networkIdentifier, nodeUrl);
	};

	useEffect(() => {
		const fetchNodeUrls = async () => {
			const urls = await api.network.fetchNodeList(networkIdentifier);
			setNodeUrls(prev => ({ ...prev, [networkIdentifier]: urls }));
		};
		fetchNodeUrls();
	}, [networkIdentifier]);

	return (
		<Screen isLoading={isSavingChanges}>
			<ScrollView>
				<FormItem>
					<StyledText type="title">{$t('s_settings_network_select_title')}</StyledText>
					<Dropdown
						value={selectedNetworkIdentifier}
						list={networkIdentifierOptions}
						title={$t('s_settings_networkType_modal_title')}
						onChange={selectNetwork}
					/>
				</FormItem>
				<FormItem>
					<Dropdown
						value={selectedNodeUrl}
						list={nodeOptions}
						title={$t('s_settings_node_select_title')}
						onChange={selectNode}
					/>
				</FormItem>
				<FormItem>
					<StyledText type="title">{$t('s_settings_node_info_title')}</StyledText>
					<Widget>
						<FormItem>
							<Animated.View entering={FadeIn} key={networkInfoTable.nodeUrl}>
								<TableView data={networkInfoTable} style={tableStyle} />
							</Animated.View>
							{isConnectingToNode && (
								<View style={styles.tableLoadingContainer}>
									<ActivityIndicator color={colors.primary} size="large" />
								</View>
							)}
						</FormItem>
					</Widget>
				</FormItem>
			</ScrollView>
		</Screen>
	);
};

const styles = StyleSheet.create({
	tableLoadingContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center'
	}
});
