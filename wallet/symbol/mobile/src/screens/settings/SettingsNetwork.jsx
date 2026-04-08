import { Card, Dropdown, LoadingIndicator, Screen, Spacer, Stack, StyledText, TableView } from '@/app/components';
import { config } from '@/app/config';
import { NetworkIdentifier } from '@/app/constants';
import { useAsyncManager, useProp, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { createNetworkMap } from 'wallet-common-core';

const isValueMissing = value => value === null || value === undefined || value === '';

/**
 * SettingsNetwork screen component. A screen for configuring network settings, allowing selection
 * of network type and node, with display of current network information including chain height and
 * fees.
 */
export const SettingsNetwork = () => {
	const walletController = useWalletController();
	const { networkProperties, networkIdentifier, selectedNodeUrl, isNetworkConnectionReady } = walletController;
	const [selectedNetworkIdentifier, setSelectedNetworkIdentifier] = useProp(networkIdentifier, networkIdentifier);
	const [nodeUrls, setNodeUrls] = useState(createNetworkMap(() => [], config.networkIdentifiers));
	const isConnectingToNode = !isNetworkConnectionReady;

	const getTableValueNullable = value => isValueMissing(value) ? '-' : value;
	const networkInfoTable = [
		{
			title: 'network',
			value: getTableValueNullable(networkProperties.networkIdentifier),
			type: 'text'
		},
		{
			title: 'nodeUrl',
			value: getTableValueNullable(networkProperties.nodeUrl),
			type: 'copy'
		},
		{
			title: 'chainHeight',
			value: getTableValueNullable(networkProperties.chainHeight),
			type: 'text'
		},
		{
			title: 'minFeeMultiplier',
			value: getTableValueNullable(networkProperties.transactionFees?.minFeeMultiplier),
			type: 'text'
		}
	];
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

	const saveChangesManager = useAsyncManager({
		callback: async (networkIdentifier, nodeUrl) => {
			await walletController.selectNetwork(networkIdentifier, nodeUrl);
		}
	});
	const selectNetwork = async networkIdentifier => {
		setSelectedNetworkIdentifier(networkIdentifier);
		saveChangesManager.call(networkIdentifier, null);
	};
	const selectNode = async nodeUrl => {
		saveChangesManager.call(networkIdentifier, nodeUrl);
	};

	useEffect(() => {
		const fetchNodeUrls = async () => {
			const urls = await walletController.networkApi.network.fetchNodeList(networkIdentifier);
			setNodeUrls(prev => ({ ...prev, [networkIdentifier]: urls }));
		};
		fetchNodeUrls();
	}, [networkIdentifier]);

	return (
		<Screen isLoading={saveChangesManager.isLoading}>
			<Spacer>
				<Stack>
					<StyledText type="title">{$t('s_settings_network_select_title')}</StyledText>
					<Dropdown
						label={$t('s_settings_networkType_modal_title')}
						value={selectedNetworkIdentifier}
						list={networkIdentifierOptions}
						onChange={selectNetwork}
					/>
					<Dropdown
						label={$t('s_settings_node_select_title')}
						value={selectedNodeUrl}
						list={nodeOptions}
						onChange={selectNode}
					/>
					<StyledText type="title">{$t('s_settings_node_info_title')}</StyledText>
					<Card>
						<Spacer>
							<Animated.View entering={FadeIn} key={networkInfoTable.nodeUrl}>
								<TableView
									isTitleTranslatable
									data={networkInfoTable}
									style={tableStyle}
								/>
							</Animated.View>
							{isConnectingToNode && (
								<View style={styles.tableLoadingContainer}>
									<LoadingIndicator size="lg" />
								</View>
							)}
						</Spacer>
					</Card>
				</Stack>
			</Spacer>
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
