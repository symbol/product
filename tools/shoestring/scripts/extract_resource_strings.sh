#!/bin/bash

set -ex

pybabel extract --omit-header --sort-output -o lang/messages.pot shoestring/*.py shoestring/**/*.py shoestring/**/**/*.py

for lang in "en" "ja";
do
	# note: to add a new language, use `init` instead of `update`
	pybabel update  --omit-header -l "${lang}" -i lang/messages.pot -d lang

	mv "lang/${lang}/LC_MESSAGES/messages.po" "lang/${lang}/LC_MESSAGES/messages.po.tmp"
	cat "lang/po.header.txt" "lang/${lang}/LC_MESSAGES/messages.po.tmp" > "lang/${lang}/LC_MESSAGES/messages.po"
	rm "lang/${lang}/LC_MESSAGES/messages.po.tmp"
done
