import { useWalletContext } from '../../context';

const AssetList = () => {
	const { walletState } = useWalletContext();
	const { mosaics } = walletState;

	return (
		<div className='flex flex-col overflow-y-auto'>
			{
				mosaics.map((mosaic, index) => (
					<div key={`asset_${index}`} className='flex items-center justify-start p-2'>
						<div className="rounded-full w-5 h-5 bg-gray-300 mr-2" />
						<div className='text-xs'>
							{
								null === mosaic.name ?
									<div>{mosaic.id}</div> :
									<div>{mosaic.name.split('.')[0]}</div>
							}

							<div>{mosaic.amount} {null !== mosaic.name ? mosaic.name.split('.').pop() : null}</div>
						</div>
					</div>
				))
			}
		</div>
	);
};

export default AssetList;
