import re
import sys
from subprocess import PIPE, STDOUT, Popen


class OpensslExecutor:
	"""Shim around the openssl executable."""

	def __init__(self, executable_path='openssl'):
		"""Creates an executor around the specified executable."""

		self.executable_path = executable_path
		self.version_regex = re.compile(r'^.*SSL +([^\s]*)')

	def version(self):
		"""Gets the version of the openssl executable."""

		version_output = ''.join(self.dispatch(['version', '-v'], False))
		match = self.version_regex.match(version_output)
		return match.group(1)

	def dispatch(self, args, command_input=None, show_output=True, use_shell=False):
		"""Dispatches an openssl command, optionally showing output."""

		command_line = [self.executable_path] + [str(arg) for arg in args]
		if use_shell:
			formatted_command_line = ' '.join(command_line)

		all_lines = []
		with Popen(formatted_command_line if use_shell else command_line, stdout=PIPE, stderr=STDOUT, stdin=PIPE, shell=use_shell) as process:
			stdout_lines, _ = process.communicate(input=command_input.encode('ascii') if command_input else None, timeout=10)

			for line_bin in stdout_lines.splitlines(keepends=True):
				line = line_bin.decode('ascii')
				all_lines.append(line)

				if show_output:
					sys.stdout.write(line)
					sys.stdout.flush()

			if 0 != process.returncode:
				formatted_command_line = ' '.join(command_line)
				raise RuntimeError(f'{formatted_command_line} exited with {process.returncode}')

		return all_lines
