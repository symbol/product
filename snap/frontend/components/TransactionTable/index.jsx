import { useWalletContext } from '../../context';
import Image from 'next/image';

const TransactionTable =({transactions}) => {

	const { walletState } = useWalletContext();
	const { account, finalizedHeight } = walletState;
	const { address } = account;

	return (
		<div className='overflow-y-auto'>
			<table className='w-full'>
				<tbody>
					{
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
									{
										'Transfer' === transaction.transactionType ?
											transaction.sender === address ? 'Sent' : 'Received'
											: transaction.transactionType
									}

									{
										null === transaction.height ?
											<div className='font-bold'>Pending</div> :
											<div className='font-bold text-green'>Confirmed</div>
									}
								</td>

								<td className='flex pt-2 text-sub-title'>
									<div className='flex flex-col items-end pr-2'>
										{
											null !== transaction.amount ?
												<>
													<div>{transaction.amount} XYM</div>
													<div>{transaction.currency}</div>
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
										{transaction.height}
										{
											finalizedHeight >= transaction.height && transaction.height ?
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
		</div>
	);
};

export default TransactionTable;
