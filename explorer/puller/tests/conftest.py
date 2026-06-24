import sys
from pathlib import Path

TESTS_PATH = Path(__file__).parent
if str(TESTS_PATH) not in sys.path:
	sys.path.append(str(TESTS_PATH))
