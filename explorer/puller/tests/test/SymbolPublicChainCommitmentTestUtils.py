import json
from pathlib import Path

PUBLIC_CHAIN_FIXTURES = Path(__file__).parents[1] / 'model' / 'symbol' / 'fixtures' / 'public_chain_commitments.json'


def load_public_chain_commitments():
	"""Loads fresh copies of the recorded public Symbol REST responses."""
	return json.loads(PUBLIC_CHAIN_FIXTURES.read_text(encoding='utf-8'))
