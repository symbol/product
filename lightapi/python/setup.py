import platform
import sys

from setuptools import setup

cmdclass = {}

if 'CPython' == platform.python_implementation():
	try:
		import wheel.bdist_wheel

		class BDistWheel(wheel.bdist_wheel.bdist_wheel):
			def __init__(self, dist, **kw):
				super().__init__(dist, **kw)
				self.py_limited_api = None

			def finalize_options(self):
				self.py_limited_api = f'cp3{sys.version_info[1]}'
				wheel.bdist_wheel.bdist_wheel.finalize_options(self)

		cmdclass['bdist_wheel'] = BDistWheel
	except ImportError:
		pass


if '__main__' == __name__:
	setup(
		# Ensure limited API is set on CPython
		cmdclass=cmdclass,
		# CFFI
		zip_safe=False,
		ext_package='_lightapi_openssl_cffi_bindings',
		cffi_modules=['cffi_src/openssl_build.py:ffi_builder'],
	)
