import { useWalletContext } from '../../context';
import helper from '../../utils/helper';
import Button from '../Button';
import FeeMultiplier from '../FeeMultiplier';
import Input from '../Input';
import ModalBox from '../ModalBox';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { SymbolFacade, models } from 'symbol-sdk/symbol';

const TransferModalBox = ({ isOpen, onRequestClose }) => {
	const { walletState, dispatch, symbolSnap } = useWalletContext();
	const { selectedAccount, network, mosaicInfo } = walletState;
	const mosaicsBalance = selectedAccount.mosaics || [];
	const facade = new SymbolFacade(network.networkName);

	const [to, setTo] = useState('');
	const [message, setMessage] = useState('');
	const [isEncrypt, setIsEncrypt] = useState(false);
	const [mosaicSelectorManager, setMosaicSelectorManager] = useState([]);
	const [selectedMosaics, setSelectedMosaics] = useState([]);
	const [selectedFeeMultiplier, setSelectedFeeMultiplier] = useState({});
	const [fees, setFees] = useState(0);

	const [errors, setErrors] = useState({
		address: null,
		message: null,
		amount: [],
		fees: null
	});

	const validateForm = () => {
		const validate = (field, value) => {
			switch (field) {
			case 'address':
				return facade.network.isValidAddressString(value) ? null : 'Invalid address';
			case 'message':
				return 1024 >= value.length ? null : 'Message length should not exceed 1024 characters';
			case 'amount':
				return value.map((amount, index) => {
					const currentBalance = mosaicsBalance.find(mosaic => mosaic.id === selectedMosaics[index].id).amount;
					let absoluteAmount = amount * (10 ** mosaicInfo[selectedMosaics[index].id].divisibility);

					if (selectedMosaics[index].id === network.currencyMosaicId && 0 < absoluteAmount)
						absoluteAmount += fees;

					return absoluteAmount > currentBalance ? 'Not enough balance' : null;
				});
			case 'fees':
				const currencyBalance = mosaicsBalance.find(mosaic => mosaic.id === network.currencyMosaicId)?.amount;
				const spendCurrencyAmount = selectedMosaics.find(mosaic => mosaic.id === network.currencyMosaicId)?.amount;

				if (spendCurrencyAmount + value > currencyBalance)
					return 'Insufficient transaction fees';
			default:
				return null;
			}
		};

		const newErrors = {
			address: validate('address', to),
			message: validate('message', message),
			amount: validate('amount', selectedMosaics.map(mosaic => mosaic.amount)),
			fees: validate('fees', fees)
		};

		setErrors(errors => ({ ...errors, ...newErrors }));
	};

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
		const updateMosaics = [...selectedMosaics];
		updateMosaics[index] = { ...updateMosaics[index], amount: Number(newAmount) };
		setSelectedMosaics(updateMosaics);
	};

	const handleMaxAmount = index => {
		let maxAmount = mosaicsBalance.find(mosaic => mosaic.id === selectedMosaics[index].id).amount;

		if (selectedMosaics[index].id === network.currencyMosaicId)
			maxAmount -= fees;

		const relativeAmount = Math.max(maxAmount, 0) / (10 ** mosaicInfo[selectedMosaics[index].id].divisibility);

		const updateMosaics = [...selectedMosaics];
		updateMosaics[index] = { ...updateMosaics[index], amount: relativeAmount };

		setSelectedMosaics(updateMosaics);
	};

	const handleInputAddress = event => {
		const newAddress = event.target.value;
		setTo(newAddress);
	};

	const handleMessageChange = event => {
		const newMessage = event.target.value;
		setMessage(newMessage);
	};

	const handleSendTransaction = async () => {
		if (errors.address || errors.message || errors.amount.some(error => error) || errors.fees)
			return;

		const transferMosaics = [];
		selectedMosaics.map(mosaic => {
			if (0 >= mosaic.amount)
				return;

			transferMosaics.push(mosaic);
		});

		const result = await helper.signTransferTransaction(dispatch, symbolSnap, {
			accountId: selectedAccount.id,
			recipient: to,
			mosaics: transferMosaics,
			message,
			fees
		});

		if (result) {
			onRequestClose();
			toast.success('Announcing transaction');
		}

	};

	const feeCalculation = () => {
		try {
			const result = helper.feeCalculator(facade, models.TransactionType.TRANSFER.value , mosaicInfo, {
				signerPublicKey: selectedAccount.publicKey,
				recipient: to || selectedAccount.address,
				mosaics: selectedMosaics,
				message,
				feeMultiplier: selectedFeeMultiplier.value
			});

			setFees(result);
		} catch {
			return;
		}
	};

	useEffect(() => {
		if (selectedAccount && selectedAccount.mosaics) {
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

	}, [selectedAccount.mosaics]);

	useEffect(() => {
		// Update mosaic selector when selectedMosaics change
		updateMosaicSelector();

	}, [selectedMosaics]);

	useEffect(() => {
		feeCalculation();
		validateForm();
	}, [selectedMosaics, to, message, selectedFeeMultiplier, fees]);

	const renderMosaicSelector = (mosaicOption, index) => {
		return (
			<div key={index} className='p-2 text-xs'>
				<div className='flex'>
					<select className='w-2/3 px-4 text-black bg-[#D9D9D9] rounded-xl' onChange={event => handleSelectChange(event, index)}>
						{
							mosaicOption.map(option => (
								<option key={option.id} value={option.id}>
									{0 < mosaicInfo[option.id].name.length ? mosaicInfo[option.id].name[0] : option.id}
								</option>
							))
						}
					</select>

					<div className='flex items-center justify-around'>
						<input className='w-2/3 px-4 py-2 text-black bg-[#D9D9D9] rounded-xl' type='number' placeholder='relative amount'
							value={selectedMosaics[index]?.amount || 0} onChange={event => handleAmountChange(event, index)} />
						<span className='cursor-pointer' onClick={() => handleMaxAmount(index)}>Max</span>
					</div>
				</div>
				<div>
					{errors.amount[index] && <p className='text-red-500 text-xs'>{errors.amount[index]}</p>}
				</div>
			</div>
		);
	};

	return (
		<ModalBox isOpen={isOpen} onRequestClose={onRequestClose}>
			<div role='transfer-form' className='flex flex-col px-5 text-center'>
				<div className='text-2xl font-bold mb-6'>
                    Send
				</div>

				<Input
					role='address-input'
					placeholder='Recipient address'
					className='p-2 flex items-start'
					label='To'
					value={to}
					onChange={handleInputAddress}
					errorMessage={errors.address}
				/>

				<div>
					<label className="p-2 flex text-sm font-medium">
                        Mosaic
					</label>

					{
						mosaicSelectorManager.map((mosaic, index) => (
							<div role='mosaic-selector' key={index}>
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
						role='message-input'
						placeholder='Message...'
						className='p-2 flex items-start'
						label='Message'
						value={message}
						onChange={handleMessageChange}
						errorMessage={errors.message}
					/>

					<div className='flex items-center justify-end'>
						<input
							role='message-checkbox'
							type='checkbox' name='isEncrypt'
							checked={isEncrypt}
							onChange={event => setIsEncrypt(event.target.checked)} /> Encrypt
					</div>

				</div>

				<FeeMultiplier selectedFeeMultiplier={selectedFeeMultiplier} setSelectedFeeMultiplier={setSelectedFeeMultiplier} />

				<div role='fees' className='p-2'>
					Fees: {fees / Math.pow(10, mosaicInfo[network.currencyMosaicId].divisibility)} XYM
					{errors.fees && <p className='text-red-500 text-xs'>{errors.fees}</p>}
				</div>

				<div>
					<Button onClick={handleSendTransaction}>Send</Button>
				</div>

			</div>
		</ModalBox>
	);
};

export default TransferModalBox;
