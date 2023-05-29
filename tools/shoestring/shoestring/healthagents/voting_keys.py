from zenlog import log

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.NodewatchClient import get_current_finalization_epoch
from shoestring.internal.VoterConfigurator import inspect_voting_key_files

NAME = 'voting keys'


def should_run(node_config):
	return NodeFeatures.VOTER in node_config.features


async def validate(context):
	current_finalization_epoch = await get_current_finalization_epoch(context.config.services.nodewatch, context.config_manager)
	first_gap_finalization_epoch = current_finalization_epoch

	voting_key_descriptors = inspect_voting_key_files(context.directories.voting_keys)
	for descriptor in voting_key_descriptors:
		if descriptor.end_epoch < current_finalization_epoch:
			log.warning(f'expired voting keys discovered for epochs {descriptor.start_epoch} to {descriptor.end_epoch}')
		elif descriptor.start_epoch <= current_finalization_epoch <= descriptor.end_epoch:
			log.info(f'active voting keys discovered for epochs {descriptor.start_epoch} to {descriptor.end_epoch}')
			first_gap_finalization_epoch = descriptor.end_epoch + 1
		else:
			log.info(f'future voting keys discovered for epochs {descriptor.start_epoch} to {descriptor.end_epoch}')

			if descriptor.start_epoch == first_gap_finalization_epoch:
				first_gap_finalization_epoch = descriptor.end_epoch + 1

	if first_gap_finalization_epoch == current_finalization_epoch:
		log.error(f'no voting keys are registered for the current epoch {current_finalization_epoch}')
	else:
		log.info(''.join([
			f'voting keys are registered from the current epoch {current_finalization_epoch}',
			f' until epoch {first_gap_finalization_epoch - 1}'
		]))
