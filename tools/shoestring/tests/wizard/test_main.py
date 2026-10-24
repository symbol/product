import builtins
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from prompt_toolkit.application import create_app_session
from prompt_toolkit.input import DummyInput
from prompt_toolkit.output import DummyOutput

from shoestring.__main__ import main as shoestring_main
from shoestring.wizard.__main__ import main
from shoestring.wizard.screen_loader import load_screens
from shoestring.wizard.ShoestringOperation import ShoestringOperation

# pylint: disable=invalid-name


@pytest.fixture(name='wizard')
def wizard_context(monkeypatch, tmp_path):
	monkeypatch.setenv('LC_MESSAGES', 'en')
	monkeypatch.delenv('SHOESTRING_HOME', raising=False)
	monkeypatch.delenv('HOME', raising=False)
	monkeypatch.chdir(tmp_path)
	# main installs translations globally; restore the original translator after each test.
	monkeypatch.setattr(builtins, '_', getattr(builtins, '_'))

	context = SimpleNamespace(screens=None, app=None, run_async=AsyncMock(return_value=None), dispatch=AsyncMock())

	def capture_screens(screens):
		load_screens(screens)
		context.screens = screens

	async def run_application(app):
		context.app = app
		return await context.run_async()

	monkeypatch.setattr('shoestring.wizard.__main__.load_screens', capture_screens)
	monkeypatch.setattr('shoestring.wizard.__main__.Application.run_async', run_application)
	monkeypatch.setattr('shoestring.wizard.__main__.dispatch_shoestring_command', context.dispatch)

	with create_app_session(input=DummyInput(), output=DummyOutput()):
		yield context


def _select_reset_data(wizard):
	button = next(button for button in wizard.screens.get('welcome').buttons if button.operation == ShoestringOperation.RESET_DATA)
	button.handler()


@pytest.mark.parametrize('home', [None, '', 'environment', 'home'])
async def test_can_start_with_default_destination(wizard, monkeypatch, tmp_path, home, caplog):
	destination = tmp_path
	if home is not None:
		if home:
			destination = tmp_path / home
			destination.mkdir()
		variable = 'HOME' if 'home' == home else 'SHOESTRING_HOME'
		monkeypatch.setenv(variable, str(destination) if home else '')

	await main()

	wizard.run_async.assert_awaited_once_with()
	assert 'welcome' == wizard.screens.current.screen_id
	assert str(destination) == wizard.screens.get('obligatory').destination_directory
	assert wizard.app.layout.has_focus(wizard.screens.current)
	assert all(callable(button.handler) for button in wizard.screens.get('welcome').buttons)
	assert callable(wizard.screens.navbar.prev.handler)
	assert callable(wizard.screens.message_box)
	wizard.dispatch.assert_not_awaited()
	assert _('wizard-main-done') not in caplog.text


@pytest.mark.parametrize('completed', [False, True])
@pytest.mark.parametrize('result', [None, True])
async def test_dispatches_only_after_completion(wizard, completed, result, caplog):
	def run_application():
		if completed:
			_select_reset_data(wizard)
			wizard.screens.navbar.next.handler()
			assert 'end-screen' == wizard.screens.current.screen_id
			assert _('wizard-button-finish') == wizard.screens.navbar.next.text
			assert wizard.app.layout.has_focus(wizard.screens.current)
		return result

	wizard.run_async.side_effect = run_application

	await main()

	wizard.run_async.assert_awaited_once_with()
	if completed and not result:
		wizard.dispatch.assert_awaited_once_with(wizard.screens, shoestring_main)
		assert _('wizard-main-done') in caplog.text
	else:
		wizard.dispatch.assert_not_awaited()
		assert _('wizard-main-done') not in caplog.text


async def test_can_navigate_forward_and_back(wizard):
	def run_application():
		_select_reset_data(wizard)
		assert ShoestringOperation.RESET_DATA == wizard.screens.get('welcome').operation
		assert 'obligatory' == wizard.screens.current.screen_id
		assert wizard.app.layout.has_focus(wizard.screens.current)

		wizard.screens.navbar.next.handler()
		assert 'end-screen' == wizard.screens.current.screen_id

		wizard.screens.navbar.prev.handler()
		assert 'obligatory' == wizard.screens.current.screen_id
		assert _('wizard-button-next') == wizard.screens.navbar.next.text
		assert wizard.app.layout.has_focus(wizard.screens.current)

		wizard.screens.navbar.prev.handler()
		assert 'welcome' == wizard.screens.current.screen_id
		assert wizard.app.layout.has_focus(wizard.screens.current)

	wizard.run_async.side_effect = run_application

	await main()

	wizard.dispatch.assert_not_awaited()


async def test_dispatch_failure_does_not_log_completion(wizard, caplog):
	def run_application():
		_select_reset_data(wizard)
		wizard.screens.navbar.next.handler()

	wizard.run_async.side_effect = run_application
	wizard.dispatch.side_effect = RuntimeError('operation failed')

	with pytest.raises(RuntimeError, match='operation failed'):
		await main()

	wizard.dispatch.assert_awaited_once_with(wizard.screens, shoestring_main)
	assert _('wizard-main-done') not in caplog.text


async def test_invalid_environment_directory_exits_before_loading_screens(wizard, monkeypatch, caplog):
	monkeypatch.setenv('SHOESTRING_HOME', 'relative/symbol')

	def unexpected_load(_screens):
		pytest.fail('screens must not be loaded with an invalid environment directory')

	monkeypatch.setattr('shoestring.wizard.__main__.load_screens', unexpected_load)

	with pytest.raises(SystemExit) as ex:
		await main()

	assert 2 == ex.value.code
	assert 'SHOESTRING_HOME must be an absolute path: relative/symbol' in caplog.text
	wizard.run_async.assert_not_awaited()
	wizard.dispatch.assert_not_awaited()
