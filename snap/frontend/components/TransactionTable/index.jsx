import { Channels, explorerUrl } from '../../config';
import { useWalletContext } from '../../context';
import helper from '../../utils/helper';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

const TransactionTable = () => {

	const { walletState, symbolSnap, dispatch } = useWalletContext();
	const { selectedAccount, finalizedHeight, mosaicInfo, network, currency, transactions, websocket } = walletState;
	const { address, id } = selectedAccount;
	const { symbol, price } = currency;
	const [isLoading, setIsLoading] = useState(false);
	const [isLastPage, setIsLastPage] = useState(false);
	const { ref, inView } = useInView();

	const getXYMRelativeAmount = amount => {
		return amount / (10 ** (mosaicInfo[network.currencyMosaicId]?.divisibility || 6));
	};

	const getXYMPrice = amount => {
		return (getXYMRelativeAmount(amount) * price).toFixed(2);
	};

	useEffect(() => {
		if (!address)
			return;

		setIsLoading(true);

		helper.updateTransactions(dispatch, symbolSnap, address);

		setIsLoading(false);

		setIsLastPage(false);

		websocket.listenConfirmedTransaction(async () => {
			helper.updateTransactions(dispatch, symbolSnap, address);
			helper.updateAccountMosaics(dispatch, symbolSnap, id);
		}, address);

		websocket.listenUnconfirmedTransaction(async () => {
			helper.updateUnconfirmedTransactions(dispatch, symbolSnap, address, transactions);
		}, address);

		return () => {
			websocket.removeSubscriber(`${Channels.confirmedAdded}/${address}`);
			websocket.removeSubscriber(`${Channels.unconfirmedAdded}/${address}`);
		};
	}, [address]);

	useEffect(() => {
		const loadMoreTransactions = async () => {
			if (isLoading || isLastPage || !inView || !address)
				return;

			setIsLoading(true);

			const lastTransactionId = 0 < transactions.length ? transactions[transactions.length - 1].id : '';
			const transactionPage = await symbolSnap.fetchAccountTransactions(address, lastTransactionId);

			setIsLastPage(0 === transactionPage.length || 10 > transactionPage.length);
			transactions.push(...transactionPage);
			setIsLoading(false);
		};

		loadMoreTransactions();
	}, [inView]);

	return (
		<div className='overflow-y-auto'>
			<table className='w-full'>
				<tbody>
					{
						(0 === transactions.length) ?
							<tr className='flex justify-center'>
								<td> No transactions found </td>
							</tr>
							:

							transactions.map((transaction, index) => (
								<tr key={`tx_row_${index}`} className='border-t-[1px] border-text h-16'>
									<td className='px-2'>
										{
											transaction.sender === address ?
												<Image
													src='/send-icon.svg'
													width={24}
													height={24}
													alt='Send logo'
												/> :
												<Image
													src='/receive-icon.svg'
													width={24}
													height={24}
													alt='Receive logo'
												/>
										}
									</td>

									<td className='px-2'>
										<a target='_blank'
											href={`${explorerUrl[network.networkName]}/transactions/${transaction.transactionHash}`}>
											{
												transaction.sender === address ? 'Sent' : 'Received'
											}

											<div className='font-bold'>{transaction.transactionType}</div>
										</a>
									</td>

									<td className='flex pt-2 text-sub-title'>
										<div className='flex flex-col items-end pr-2'>
											{
												null !== transaction.amount ?
													<>
														<div>{getXYMRelativeAmount(transaction.amount)} XYM</div>
														<div>{getXYMPrice(transaction.amount) } {symbol.toUpperCase()}</div>
													</>
													: null
											}
										</div>
										{
											null !== transaction.message ?
												<Image
													src='/message-icon.svg'
													width={24}
													height={24}
													alt='Message logo'
												/> :
												null
										}
									</td>

									<td className='text-sub-title'>
										<div className='flex items-center'>
											{
												'0' !== transaction.height ?
													<a
														target='_blank'
														href={`${explorerUrl[network.networkName]}/blocks/${transaction.height}`}>
														{transaction.height}
													</a> :

													<div className='font-bold'>Pending</div>
											}

											{
												finalizedHeight >= transaction.height && '0' !== transaction.height ?
													<Image
														className='pl-2'
														src='/finalized-icon.svg'
														width={24}
														height={24}
														alt='Finalized logo'
													/> : null
											}
										</div>

										{transaction.date}
									</td>
								</tr>
							))
					}
				</tbody>
			</table>
			{!isLastPage && 0 !== transactions.length && <div ref={ref}>Loading more...</div>}
		</div>
	);
};

export default TransactionTable;
