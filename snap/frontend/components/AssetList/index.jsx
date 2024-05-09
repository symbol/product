import { useWalletContext } from '../../context';

const AssetList = () => {
	const { walletState } = useWalletContext();
	const { mosaics } = walletState;

	const renderSubNamespace = name => {
		const split = name.split('.');

		if (1 === split.length)
			return '';

		return split.slice(1).join('.');
	};

	return (
		<div className='flex flex-col overflow-y-auto'>
			{
				mosaics.map((mosaic, index) => (
					<div key={`asset_${index}`} className='flex items-center justify-start p-2'>
						<div role={`mosaic-image_${index}`} className="rounded-full w-5 h-5 bg-gray-300 mr-2" />
						<div className='text-xs'>
							{
								null === mosaic.name ?
									<div>{mosaic.id}</div> :
									<div>{mosaic.name.split('.')[0]}</div>
							}

							<div>{mosaic.amount} {null !== mosaic.name ? renderSubNamespace(mosaic.name) : null}</div>
						</div>
					</div>
				))
			}
		</div>
	);
};

export default AssetList;
