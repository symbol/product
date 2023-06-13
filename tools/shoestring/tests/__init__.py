import gettext

lang = gettext.translation('messages', localedir='lang', languages=('en',))
lang.install()
