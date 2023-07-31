import gettext

lang = gettext.translation('messages', localedir='shoestring/lang', languages=('en',))
lang.install()
