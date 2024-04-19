import { useWalletContext } from '../../context';

const LoadingScreen = () => {
	const { walletState } = useWalletContext();
	const { isLoading, message } = walletState.loadingStatus;

	return (
		isLoading && (
			<div role='overlay' className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
				{message}
			</div>
		)
	);
};

export default LoadingScreen;
