import { useWalletContext } from '../../context';
import { useEffect, useState } from 'react';

const AssetList = () => {
	const { walletState } = useWalletContext();
	const { selectedAccount, mosaicInfo } = walletState;

	const [isLoading, setIsLoading] = useState(true);

	const renderSubNamespace = name => {
		const split = name.split('.');

		if (1 === split.length)
			return '';

		return split.slice(1).join('.');
	};

	const renderMosaicNameOrId = mosaic => {
		// Check if mosaic information exists and render based on condition
		const mosaicDetail = mosaicInfo[mosaic.id];

		if (!mosaicDetail)
			throw new Error('Mosaic information not found');

		return 0 === mosaicDetail.name.length ? (
			<div>{mosaic.id}</div>
		) : (
			<div>{mosaicDetail.name[0].split('.')[0]}</div>
		);
	};

	const renderMosaicDetails = mosaic => {
		const mosaicDetail = mosaicInfo[mosaic.id];

		if (!mosaicDetail)
			throw new Error('Mosaic information not found');

		const amount = mosaic.amount / (10 ** mosaicDetail.divisibility);
		const subNamespace = 0 === mosaicDetail.name.length ? null : renderSubNamespace(mosaicDetail.name[0]);

		return (
			<div className='text-xs text-gray-400'>
				{amount} {subNamespace}
			</div>
		);
	};

	useEffect(() => {
		// Check if mosaicInfo and selectedAccount are loaded
		if (mosaicInfo && selectedAccount && Array.isArray(selectedAccount.mosaics))
			setIsLoading(false);
		else
			setIsLoading(true);

	}, [mosaicInfo, selectedAccount]);

	if (isLoading)
		return <div>Loading...</div>;


	return (
		<div className='flex flex-col overflow-y-auto'>
			{
				selectedAccount.mosaics.map((mosaic, index) => (
					<div key={`asset_${index}`} className='flex items-center justify-start p-2'>
						<div role={`mosaic-image_${index}`} className="rounded-full w-5 h-5 bg-gray-300 mr-2" />
						<div className='text-xs'>
							{ renderMosaicNameOrId(mosaic) }
							{ renderMosaicDetails(mosaic) }
						</div>
					</div>
				))
			}
		</div>
	);
};

export default AssetList;
