import { useWalletContext } from '../../context';
import React, { useEffect, useState } from 'react';

const FeeMultiplier = ({selectedFeeMultiplier, setSelectedFeeMultiplier}) => {
	const { symbolSnap } = useWalletContext();
	const [feeMultiplier, setFeeMultiplier] = useState({});

	useEffect(() => {
		const getFeeMultiplier = async () => {
			const result = await symbolSnap.getFeeMultiplier();
			setFeeMultiplier(result);
		};

		getFeeMultiplier();
	}, [symbolSnap]);

	const renderFeeMultiplier = key => {
		return (
			<label key={key} className='flex items-center cursor-pointer highest'>
				<input
					type='radio'
					name='feeMultiplier'
					value={feeMultiplier[key]}
					className='appearance-none'
					onClick={() => setSelectedFeeMultiplier(key)} />
				<div className={`rounded-xl text-center p-2 ${selectedFeeMultiplier === key ? 'border-2' : ''}`}>
					{key.toUpperCase()}
				</div>
			</label>
		);
	};

	return (
		<div className='flex justify-evenly p-2'>
			{
				0 < Object.keys(feeMultiplier).length && (
					Object.keys(feeMultiplier).map(key => {
						return renderFeeMultiplier(key);
					})
				)
			}
		</div>
	);
};

export default FeeMultiplier;
