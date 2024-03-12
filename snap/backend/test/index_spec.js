import { expect } from '@jest/globals';
import snapsJest from '@metamask/snaps-jest';
import { panel, text } from '@metamask/snaps-sdk';

const { installSnap } = snapsJest;

describe('onRpcRequest', () => {
	describe('hello', () => {
		it('shows a confirmation dialog', async () => {
			const { request } = await installSnap();

			const origin = 'Jest';
			const response = request({
				method: 'hello',
				origin
			});

			const ui = await response.getInterface();
			expect(ui.type).toBe('confirmation');
			expect(ui).toRender(panel([text(`Hello, **${origin}**!`)]));

			await ui.ok();

			expect(await response).toRespondWith(true);
		});
	});

	it('throws an error if the requested method does not exist', async () => {
		const { request, close } = await installSnap();

		const response = await request({
			method: 'foo'
		});

		expect(response).toRespondWithError({
			code: -32603,
			message: 'Method not found.',
			stack: expect.any(String)
		});

		await close();
	});
});
