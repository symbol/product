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
			log.warning(_('health-voting-keys-expired').format(start_epoch=descriptor.start_epoch, end_epoch=descriptor.end_epoch))
		elif descriptor.start_epoch <= current_finalization_epoch <= descriptor.end_epoch:
			log.info(_('health-voting-keys-active').format(start_epoch=descriptor.start_epoch, end_epoch=descriptor.end_epoch))
			first_gap_finalization_epoch = descriptor.end_epoch + 1
		else:
			log.info(_('health-voting-keys-future').format(start_epoch=descriptor.start_epoch, end_epoch=descriptor.end_epoch))

			if descriptor.start_epoch == first_gap_finalization_epoch:
				first_gap_finalization_epoch = descriptor.end_epoch + 1

	if first_gap_finalization_epoch == current_finalization_epoch:
		log.error(_('health-voting-keys-not-registered').format(epoch=current_finalization_epoch))
	else:
		log.info(_('health-voting-keys-registered').format(
			start_epoch=current_finalization_epoch,
			end_epoch=first_gap_finalization_epoch - 1))
