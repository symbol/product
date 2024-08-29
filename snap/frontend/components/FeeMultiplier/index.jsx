import { useWalletContext } from '../../context';
import React, { useEffect, useState } from 'react';

const FeeMultiplier = ({selectedFeeMultiplier, setSelectedFeeMultiplier}) => {
	const { symbolSnap } = useWalletContext();
	const [feeMultiplierOption, setFeeMultiplierOption] = useState({});

	useEffect(() => {
		const getFeeMultiplier = async () => {
			const result = await symbolSnap.getFeeMultiplier();
			setFeeMultiplierOption(result);

			const [key, value] = Object.entries(result)[0];
			setSelectedFeeMultiplier({ key, value });
		};

		getFeeMultiplier();
	}, [symbolSnap]);

	const renderFeeMultiplier = (key, value) => {
		return (
			<label key={key} className='flex items-center cursor-pointer highest'>
				<input
					type='radio'
					name='feeMultiplier'
					value={feeMultiplierOption[key]}
					className='appearance-none'
					onClick={() => setSelectedFeeMultiplier({
						key,
						value
					}) } />
				<div className={`rounded-xl text-center p-2 ${selectedFeeMultiplier.key === key ? 'border-2' : ''}`}>
					{key.toUpperCase()}
				</div>
			</label>
		);
	};

	return (
		<div className='flex justify-evenly p-2'>
			{
				feeMultiplierOption && 0 < Object.keys(feeMultiplierOption).length && (
					Object.entries(feeMultiplierOption).map(([key, value]) => {
						return renderFeeMultiplier(key, value);
					})
				)
			}
		</div>
	);
};

export default FeeMultiplier;
