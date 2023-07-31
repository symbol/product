#!/bin/bash

set -ex

pybabel extract --omit-header --sort-output -o shoestring/lang/messages.pot shoestring/*.py shoestring/**/*.py shoestring/**/**/*.py

for lang in "en" "ja";
do
	# note: to add a new language, use `init` instead of `update`
	pybabel update  --omit-header -l "${lang}" -i shoestring/lang/messages.pot -d shoestring/lang

	mv "shoestring/lang/${lang}/LC_MESSAGES/messages.po" "shoestring/lang/${lang}/LC_MESSAGES/messages.po.tmp"
	cat "shoestring/lang/po.header.txt" "shoestring/lang/${lang}/LC_MESSAGES/messages.po.tmp" > "shoestring/lang/${lang}/LC_MESSAGES/messages.po"
	rm "shoestring/lang/${lang}/LC_MESSAGES/messages.po.tmp"
done
