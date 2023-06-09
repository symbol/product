import asyncio


async def calculate_min_cosignatures_count(connector, address):
	"""Calcuates the minimum number of cosigners for an account."""

	multisig_info = await connector.account_multisig(address)

	if 0 != multisig_info.min_approval:
		cosignatory_multisig_infos = await asyncio.gather(*[
			connector.account_multisig(cosignatory_address) for cosignatory_address in multisig_info.cosignatory_addresses
		])

		if any(0 != multisig_info.min_approval for multisig_info in cosignatory_multisig_infos):
			raise RuntimeError(f'cannot auto detect min cosignatures for a multi level multisig account ({address})')

	return multisig_info.min_approval
