"""Bounded verification of the stored Symbol branch against fixed node evidence."""
import asyncio
import time
from collections import namedtuple
from contextlib import contextmanager
from enum import Enum

from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason

MAX_EVIDENCE_PAGE_SIZE = 100
MAX_RECONCILIATION_REQUESTS = 100
RECONCILIATION_SECONDS = 30
MAX_COMMON_POINT_DEPTH = 10_000
MAX_CONSECUTIVE_INVALIDATIONS = 3
ZERO_HASH = bytes(32)

FinalizedBlock = namedtuple('FinalizedBlock', ('height', 'hash', 'epoch', 'point'))
BranchMatch = namedtuple('BranchMatch', (
	'height', 'hash', 'fork_height', 'fork_hash', 'difference', 'finalized', 'has_finality_evidence', 'finalized_parent', 'comparison_tip'))
ReconciliationRange = namedtuple(
	'ReconciliationRange', ('search_start', 'search_floor', 'compare_end', 'proof_required', 'finalized', 'revision'))


class BlockDifference(str, Enum):
	"""Identifies what the first local divergence proves about the branch."""

	MISSING = 'missing'
	PARENT_MISMATCH = 'parent_mismatch'
	HASH_MISMATCH = 'hash_mismatch'


class SymbolRollbackError(RuntimeError):
	"""Raised when Symbol rollback repair cannot safely proceed."""


class RecoveryStopped(SymbolRollbackError):
	"""Carries the persisted reason for stopping both writing workflows."""

	def __init__(self, reason, message):
		super().__init__(message)
		self.reason = reason


class EvidenceChanged(RecoveryStopped):
	"""Indicates a pinned node or database fact changed during reconciliation."""

	def __init__(self, message='Pinned Symbol reconciliation evidence changed'):
		super().__init__(ForkRecoveryStopReason.RECONCILIATION_WAIT, message)


class ShorteningDeferred(RecoveryStopped):
	"""A matching node branch grew beyond the previously observed shortened tip."""

	def __init__(self):
		super().__init__(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Node chain tip changed before Symbol shortening repair')


class ReconciliationBudgetExceeded(RecoveryStopped):
	"""Indicates that a later invocation may resume completed comparison pages."""

	def __init__(self):
		super().__init__(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Symbol branch reconciliation request budget exhausted')


class ReconciliationBudget:
	"""Charges individual attempts and bounds requests including rate limiting and retries."""

	def __init__(self, max_requests=MAX_RECONCILIATION_REQUESTS, time_limit=RECONCILIATION_SECONDS, time_source=time.monotonic):
		self._time_source = time_source
		self._deadline = time_source() + time_limit
		self._remaining_attempts = max_requests

	async def run(self, operation):
		"""Bounds a comparison request, including its rate-limit wait and retries."""

		try:
			result = await asyncio.wait_for(operation, timeout=max(0, self._deadline - self._time_source()))
		except asyncio.TimeoutError as error:
			raise self.exhausted() from error

		self.check_deadline()
		return result

	def check_deadline(self):
		"""Stops evidence work that exhausted the common elapsed reconciliation budget."""

		if self._time_source() >= self._deadline:
			raise self.exhausted()

	def remaining_ms(self):
		"""Returns the maximum whole milliseconds available for a database statement."""

		return int((self._deadline - self._time_source()) * 1000)

	@contextmanager
	def exclude_time(self):
		"""Excludes work that has its own inspection or request limits."""

		started_at = self._time_source()
		try:
			yield
		finally:
			self._deadline += self._time_source() - started_at

	def charge_attempt(self):
		"""Charges an HTTP attempt immediately before it is issued."""

		self.check_deadline()
		if not self._remaining_attempts:
			raise self.exhausted()

		self._remaining_attempts -= 1

	@staticmethod
	def exhausted():
		"""Provides the retryable comparison stop."""

		return ReconciliationBudgetExceeded()


class ForkReconciliation:
	"""Searches for a common point and verifies relevant saved and finalized ranges."""

	def __init__(self, database, fetch_block, fetch_page, budget, *, should_persist=True):
		self._database = database
		self._fetch_block = fetch_block
		self._fetch_page = fetch_page
		self._budget = budget
		self._should_persist = should_persist
		self.admin_progress = None
		self.saved_progress = None
		self.has_conflicting_history = False

	async def verify(self, recovery, scope, admin_progress=None):
		"""Resumes fixed evidence or saves a fresh comparison before reading its first page."""

		self._budget.check_deadline()
		self.admin_progress = None
		progress = recovery['progress'] if self._should_persist else admin_progress
		progress = progress.copy() if progress and 'revision' in progress else None
		invalidations = recovery['invalidations']
		if progress:
			# Older comparisons also carried a copy of the proof owned by the repair checkpoint.
			progress.pop('replacement_proof', None)
			if not self._should_persist:
				self.admin_progress = progress.copy()

			try:
				await self._recheck_progress(progress, scope)
				self._classify_saved_difference(progress)
			except EvidenceChanged:
				self.invalidate(invalidations)
				raise

		if not progress:
			progress = await self._pin_range(scope, invalidations)

		try:
			await self._search_common_point(progress, invalidations)
			finalized_height, finalized_hash, _, _ = progress['finalized']
			if progress['common_height'] == finalized_height:
				if progress['common_evidence'][0] != finalized_hash:
					raise EvidenceChanged('Node finalized block hash does not match chain info')

				self._record_finalized_evidence(progress, progress['common_evidence'][1])

			self._save(progress, invalidations)
			match = await self._verify_forward(progress, invalidations)
			if match.fork_height is None and scope.compare_end > progress['compare_end']:
				end_evidence = await self._fetch_block(scope.compare_end)
				progress['compare_end'] = scope.compare_end
				progress['end_evidence'] = self._encode_evidence(end_evidence)
				progress['checked_height'] = match.height
				progress['checked_evidence'] = progress['common_evidence']
				self._save(progress, invalidations)
				match = await self._verify_forward(progress, invalidations)

			if self._database.try_get_fork_recovery_state()['block_revision'] != scope.revision:
				raise EvidenceChanged()

			self._budget.check_deadline()
			return match
		except EvidenceChanged:
			self.invalidate(invalidations)
			raise

	def save_replacement_scan(self, name, scan, invalidations):
		"""Keeps authenticated replacement pages alongside their comparison revision."""

		progress = self.saved_progress if self._should_persist else self.admin_progress
		self._save({**progress, name: scan}, invalidations)

	@staticmethod
	def check_invalidation_limit(invalidations):
		"""Stops reconciliation after consecutive contradictory evidence."""

		if invalidations >= MAX_CONSECUTIVE_INVALIDATIONS:
			raise RecoveryStopped(ForkRecoveryStopReason.EVIDENCE_INVALIDATED, 'Symbol reconciliation evidence changed too many consecutive times')

	def invalidate(self, invalidations):
		"""Discards the changed facts and enforces the consecutive invalidation limit."""

		if not self._should_persist:
			return

		self.discard(invalidations + 1, recheck_legacy_tip=True)
		self.check_invalidation_limit(invalidations + 1)

	def discard(self, invalidations, *, recheck_legacy_tip=False):
		"""Clears an obsolete comparison while preserving the supplied invalidation count."""

		if self._should_persist:
			with self._budget.exclude_time(), self._database.independent_reconciliation():
				self._database.update_fork_reconciliation(
					None, invalidations, ForkRecoveryStopReason.RECONCILIATION_WAIT, recheck_legacy_tip=recheck_legacy_tip)

	async def _pin_range(self, scope, invalidations):
		end_evidence = await self._fetch_block(scope.compare_end) if scope.compare_end else (ZERO_HASH, ZERO_HASH)
		finalized = scope.finalized
		if finalized.height and scope.compare_end == finalized.height and end_evidence[0] != finalized.hash:
			self.has_conflicting_history = True

		progress = {
			'revision': scope.revision,
			'search_start': scope.search_start,
			'search_next': scope.search_start,
			'search_floor': scope.search_floor,
			'compare_end': scope.compare_end,
			'end_evidence': self._encode_evidence(end_evidence),
			'proof_required': scope.proof_required,
			'finalized': [finalized.height, finalized.hash.hex(), finalized.epoch, finalized.point],
			'has_finality_evidence': 0 == finalized.height,
			'finalized_parent': None,
			'checked_height': None,
			'checked_evidence': None,
			'common_height': None,
			'common_evidence': None,
			'fork_height': None,
			'fork_evidence': None,
			'fork_difference': None
		}
		self._save(progress, invalidations)
		return progress

	async def _recheck_progress(self, progress, scope):
		fixed_finalized_height, fixed_finalized_hash, _, _ = progress['finalized']
		same_finalized_height = fixed_finalized_height == scope.finalized.height
		different_finalized_hash = fixed_finalized_hash != scope.finalized.hash.hex()
		finality_changed = fixed_finalized_height > scope.finalized.height or (same_finalized_height and different_finalized_hash)
		if not self._should_persist and (not same_finalized_height or progress['search_start'] != scope.search_start):
			raise EvidenceChanged()

		if progress['revision'] != scope.revision or progress['compare_end'] > scope.compare_end or finality_changed:
			raise EvidenceChanged()

		# A new finalized height can make a previously blocked legacy fork repairable.
		fork_height = progress['fork_height']
		if scope.proof_required and fork_height is not None and fixed_finalized_height < fork_height <= scope.finalized.height:
			raise EvidenceChanged()

		await self._recheck_node_anchors(progress, fixed_finalized_height, fixed_finalized_hash)

	async def _recheck_node_anchors(self, progress, fixed_finalized_height, fixed_finalized_hash):
		anchors = [
			(progress['compare_end'], progress['end_evidence']),
			(progress['checked_height'], progress['checked_evidence']),
			(progress['common_height'], progress['common_evidence']),
			(progress['fork_height'], progress['fork_evidence'])
		]
		checked_height = progress['checked_height'] or 0
		if fixed_finalized_height and (progress['proof_required'] or checked_height >= fixed_finalized_height):
			anchors.append((fixed_finalized_height, [fixed_finalized_hash, progress['finalized_parent']]))

		read_evidence = {}
		for height, expected in anchors:
			if not height:
				continue

			if height not in read_evidence:
				read_evidence[height] = self._encode_evidence(await self._fetch_block(height))

			actual_hash, actual_parent = read_evidence[height]
			expected_hash, expected_parent = expected
			if actual_hash != expected_hash or expected_parent is not None and actual_parent != expected_parent:
				raise EvidenceChanged()

		if fixed_finalized_height in read_evidence:
			progress['finalized_parent'] = read_evidence[fixed_finalized_height][1]

	async def _search_common_point(self, progress, invalidations):
		while progress['common_height'] is None:
			end = progress['search_next']
			floor = progress['search_floor']
			if 0 == end and 0 == floor:
				self._set_common_point(progress, 0, (ZERO_HASH, ZERO_HASH))
				return

			if end < max(1, floor):
				raise RecoveryStopped(ForkRecoveryStopReason.COMMON_POINT_LIMIT, 'No Symbol common block within the reconciliation search limit')

			start = max(1, floor, end - MAX_EVIDENCE_PAGE_SIZE + 1)
			node_blocks = await self._fetch_page(start, end)
			local_blocks = self._get_local_blocks(start, end)
			for height in range(end, start - 1, -1):
				node_evidence = node_blocks[height - start]
				self._check_comparison_tip(progress, height, self._encode_evidence(node_evidence))
				if local_blocks.get(height) == node_evidence:
					self._set_common_point(progress, height, node_evidence)
					return

				self.has_conflicting_history = True

			progress['search_next'] = start - 1
			progress['checked_height'] = start
			progress['checked_evidence'] = self._encode_evidence(node_blocks[0])
			self._save(progress, invalidations)

	@staticmethod
	def _encode_evidence(evidence):
		return [value.hex() for value in evidence]

	def _set_common_point(self, progress, height, block_evidence):
		encoded = self._encode_evidence(block_evidence)
		progress.update(
			common_height=height, common_evidence=encoded,
			checked_height=height, checked_evidence=encoded)

	@staticmethod
	def _record_finalized_evidence(progress, parent):
		known_parent = progress['finalized_parent']
		if known_parent is not None and known_parent != parent:
			raise EvidenceChanged()

		progress['finalized_parent'] = parent
		progress['has_finality_evidence'] = True

	@staticmethod
	def _check_comparison_tip(progress, height, encoded):
		if height == progress['compare_end'] and encoded != progress['end_evidence']:
			raise EvidenceChanged()

	async def _verify_forward(self, progress, invalidations):
		finalized_height, finalized_hash, epoch, point = progress['finalized']
		finalized = FinalizedBlock(finalized_height, bytes.fromhex(finalized_hash), epoch, point)
		while progress['checked_height'] < self._get_forward_end(progress, finalized_height):
			start = progress['checked_height'] + 1
			end = min(start + MAX_EVIDENCE_PAGE_SIZE - 1, self._get_forward_end(progress, finalized_height))
			node_blocks = await self._fetch_page(start, end)
			local_blocks = self._get_local_blocks(start, min(end, progress['compare_end']))
			self._check_forward_page(progress, finalized, start, node_blocks, local_blocks)
			self._save(progress, invalidations)

		# Matching the saved finalized hash directly also covers a common point
		# found above finality. Legacy searches always start at or below finality.
		return BranchMatch(
			progress['common_height'], bytes.fromhex(progress['common_evidence'][0]), progress['fork_height'],
			bytes.fromhex(progress['fork_evidence'][0]) if progress['fork_height'] else None,
			progress['fork_difference'], finalized, progress['has_finality_evidence'],
			bytes.fromhex(progress['finalized_parent']) if progress['finalized_parent'] is not None else None,
			(progress['compare_end'], tuple(bytes.fromhex(value) for value in progress['end_evidence'])))

	def _get_local_blocks(self, start, end):
		rows = self._database.get_block_chain_evidence(start, end)
		self._budget.check_deadline()
		return {height: (bytes(block_hash), bytes(previous_hash)) for height, block_hash, previous_hash in rows}

	def _classify_saved_difference(self, progress):
		if 'fork_difference' in progress:
			return

		fork_height = progress['fork_height']
		if fork_height is None:
			progress['fork_difference'] = None
			return

		local_evidence = self._get_local_blocks(fork_height, fork_height).get(fork_height)
		node_hash = bytes.fromhex(progress['fork_evidence'][0])
		progress['fork_difference'] = self._difference(local_evidence, node_hash)

	@staticmethod
	def _get_forward_end(progress, finalized_height):
		fork_height = progress['fork_height']
		if fork_height is not None:
			return max(fork_height, finalized_height) if progress['proof_required'] or fork_height <= finalized_height else fork_height

		return max(progress['compare_end'], finalized_height) if progress['proof_required'] else progress['compare_end']

	def _check_forward_page(self, progress, finalized, start, node_blocks, local_blocks):
		previous_hash = bytes.fromhex(progress['checked_evidence'][0])
		for height, (block_hash, actual_previous_hash) in enumerate(node_blocks, start):
			if actual_previous_hash != previous_hash:
				raise EvidenceChanged()

			evidence = (block_hash, actual_previous_hash)
			encoded = self._encode_evidence(evidence)
			self._check_comparison_tip(progress, height, encoded)
			if height == finalized.height:
				if block_hash != finalized.hash:
					raise EvidenceChanged('Node finalized block hash does not match chain info')

				self._record_finalized_evidence(progress, encoded[1])

			if height <= progress['compare_end'] and progress['fork_height'] is None:
				local_evidence = local_blocks.get(height)
				if local_evidence == evidence:
					progress.update(common_height=height, common_evidence=encoded)
				else:
					self.has_conflicting_history = True
					progress.update(fork_height=height, fork_evidence=encoded, fork_difference=self._difference(local_evidence, block_hash))

			previous_hash = block_hash
			progress.update(checked_height=height, checked_evidence=encoded)

	@staticmethod
	def _difference(local_evidence, node_hash):
		if local_evidence is None:
			return BlockDifference.MISSING

		return BlockDifference.HASH_MISMATCH if local_evidence[0] != node_hash else BlockDifference.PARENT_MISMATCH

	def _save(self, progress, invalidations):
		self._budget.check_deadline()
		if self._should_persist:
			self._database.update_fork_reconciliation(progress, invalidations, ForkRecoveryStopReason.RECONCILIATION_WAIT)
			self.saved_progress = progress.copy()
			self._budget.check_deadline()
		else:
			self.admin_progress = progress.copy()
