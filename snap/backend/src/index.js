import { panel, text } from '@metamask/snaps-sdk';

// eslint-disable-next-line import/prefer-default-export
export const onRpcRequest = async ({ origin, request }) => {
	switch (request.method) {
	case 'hello':
		return snap.request({
			method: 'snap_dialog',
			params: {
				type: 'confirmation',
				content: panel([
					text(`Hello, **${origin}**!`)
				])
			}
		});
	default:
		throw new Error('Method not found.');
	}
};
