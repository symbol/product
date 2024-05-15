import { useWalletContext } from '../../context';
import Button from '../Button';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useEffect, useState } from 'react';

const TransferModalBox = ({ isOpen, onRequestClose }) => {
	const { walletState } = useWalletContext();
	const { selectedAccount, accountsMosaics } = walletState;
	const { address } = selectedAccount || {};
	const mosaicsBalance = accountsMosaics[address] || [];

	const [to, setTo] = useState('');
	const [message, setMessage] = useState('');
	const [isEncrypt, setIsEncrypt] = useState(false);
	const [mosaicSelectorManager, setMosaicSelectorManager] = useState([]);
	const [selectedMosaics, setSelectedMosaics] = useState([]);

	const getUnselectedMosaics = () => {
		const selectedMosaicIds = selectedMosaics.map(mosaic => mosaic.id);
		return mosaicsBalance.filter(mosaic => !selectedMosaicIds.includes(mosaic.id));
	};

	const updateMosaicSelector = () => {
		const updatedMosaicSelectorManager = selectedMosaics.map((mosaic, index) => {
			const unselected = getUnselectedMosaics();
			const selected = mosaicsBalance.find(ori => ori.id === mosaic.id);
			return mosaicSelectorManager[index] = [selected, ...unselected];
		});

		setMosaicSelectorManager(updatedMosaicSelectorManager);
	};

	const addMosaic = () => {
		const unSelectedMosaics = getUnselectedMosaics();

		setSelectedMosaics([...selectedMosaics, {
			id: unSelectedMosaics[0].id,
			amount: 0
		}]);
	};

	const removeMosaic = () => {
		// Remove the last item
		const updateSelectedMosaics = selectedMosaics.slice(0, -1);

		setSelectedMosaics(updateSelectedMosaics);
	};

	const handleSelectChange = (event, index) => {
		const updateMosaic = {
			id: event.target.value,
			amount: 0
		};

		const updateSelectedMosaics = selectedMosaics.map((mosaic, i) => i === index ? updateMosaic : mosaic);

		setSelectedMosaics(updateSelectedMosaics);
	};

	const handleAmountChange = (event, index) => {
		const newAmount = event.target.value;

		setSelectedMosaics(prevMosaics => {
			const newMosaics = [...prevMosaics];
			newMosaics[index] = { ...newMosaics[index], amount: newAmount };
			return newMosaics;
		});
	};

	const handleMaxAmount = index => {
		const maxAmount = mosaicsBalance.find(mosaic => mosaic.id === selectedMosaics[index].id).amount;
		selectedMosaics[index].amount = maxAmount;
		setSelectedMosaics([...selectedMosaics]);
	};

	useEffect(() => {
		if (selectedAccount && accountsMosaics) {
			if (0 === mosaicsBalance.length) {
				return;
			} else {
				setSelectedMosaics([{
					id: mosaicsBalance[0].id,
					amount: 0
				}]);
				setMosaicSelectorManager([mosaicsBalance]);
			}
		}

	}, [accountsMosaics]);

	useEffect(() => {
		// Update mosaic selector when selectedMosaics change
		updateMosaicSelector();
	}, [selectedMosaics]);

	const renderMosaicSelector = (mosaicOption, index) => {
		return (
			<div key={index} className='p-2 flex text-xs'>
				<select className='w-2/3 px-4 text-black bg-[#D9D9D9] rounded-xl' onChange={event => handleSelectChange(event, index)}>
					{
						mosaicOption.map(option => (
							<option key={option.id} value={option.id}>
								{option.name ? option.name : option.id}
							</option>
						))
					}
				</select>

				<div className='flex items-center justify-around'>
					<input className='w-2/3 px-4 py-2 text-black bg-[#D9D9D9] rounded-xl' type='number'
						value={selectedMosaics[index]?.amount || 0} onChange={event => handleAmountChange(event, index)} />
					<span className='cursor-pointer' onClick={() => handleMaxAmount(index)}>Max</span>
				</div>
			</div>
		);
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                    Send
				</div>

				<Input
					className='p-2 flex items-start'
					label='To'
					value={to}
					onChange={event => setTo(event.target.value)}
					errorMessage={false && 'Invalid private key'}
				/>

				<div>
					<label className="p-2 flex text-sm font-medium">
                        Mosaic
					</label>

					{
						mosaicSelectorManager.map((mosaic, index) => (
							<div key={index}>
								{renderMosaicSelector(mosaic, index)}
							</div>
						))
					}

					<div className='flex justify-end'>
						{
							mosaicsBalance.length > mosaicSelectorManager.length &&
                            <div className='p-2 flex justify-end cursor-pointer' onClick={addMosaic}>
                                Add
                            </div>
						}

						{
							1 < mosaicSelectorManager.length &&
                            <div className='p-2 flex justify-end cursor-pointer' onClick={removeMosaic}>
                                Remove
                            </div>
						}
					</div>
				</div>

				<div>
					<Input
						className='p-2 flex items-start'
						label='Message'
						value={message}
						onChange={event => setMessage(event.target.value)}
					/>

					<div className='flex items-center justify-end'>
						<input type='checkbox' name='isEncrypt'
							checked={isEncrypt}
							onChange={event => setIsEncrypt(event.target.checked)} /> Encrypt
					</div>

				</div>
				<div>
					<Button>Send</Button>
				</div>

			</div>
		</ModalBox>
	);
};

export default TransferModalBox;
