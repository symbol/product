from enum import Enum


class ForkRecoveryStopReason(str, Enum):
	"""Durable reasons that block Symbol chain and account population writes."""

	CAP_BLOCKS_DIRTY_REPAIR = 'cap_blocks_dirty_repair'
	COMMON_POINT_LIMIT = 'common_point_limit'
	EVIDENCE_INVALIDATED = 'evidence_invalidated'
	FINALIZED_HASH_CONFLICT = 'finalized_hash_conflict'
	LEGACY_CHECKPOINT_MISSING = 'legacy_checkpoint_missing'
	LEGACY_DIRTY_BEFORE_FORK = 'legacy_dirty_before_fork'
	LEGACY_FORK_UNPROVEN = 'legacy_fork_unproven'
	LEGACY_NODE_BEHIND_PUBLIC = 'legacy_node_behind_public'
	LEGACY_PUBLIC_HASH_CONFLICT = 'legacy_public_hash_conflict'
	MIGRATION_PENDING = 'migration_pending'
	NODE_BEHIND_VERIFIED = 'node_behind_verified'
	RECONCILIATION_WAIT = 'reconciliation_wait'
	RESTORATION_EVIDENCE_MISSING = 'restoration_evidence_missing'
	RESUME_WAIT = 'resume_wait'
	VERIFIED_ANCHOR_CONFLICT = 'verified_anchor_conflict'
