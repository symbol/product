import { useWalletContext } from '../../context';

const LoadingScreen = () => {
	const { walletState } = useWalletContext();
	const { isLoading, loadingMessage } = walletState;

	return (
		isLoading && (
			<div role='overlay' className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
				{loadingMessage}
			</div>
		)
	);
};

export default LoadingScreen;
