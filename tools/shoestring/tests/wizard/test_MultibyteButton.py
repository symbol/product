from prompt_toolkit.utils import get_cwidth

from shoestring.wizard.MultibyteButton import MultibyteButton


def test_multibyte_button_centering():
	# Arrange
	label = 'あいうえお'
	button = MultibyteButton(label)
	button.width = 15
	button.left_symbol = '<'
	button.right_symbol = '>'
	button.text = label

	# Act
	# pylint: disable=protected-access
	fragments = button._get_text_fragments()

	# Assert
	found = False
	for frag in fragments:
		if len(frag) == 3 and frag[0] == 'class:button.text':
			found = True
			# Verify that the label is centered
			assert frag[1].strip() == label
			# Verify that the width is correct
			assert get_cwidth(frag[1]) == button.width - (
				get_cwidth(button.left_symbol) + get_cwidth(button.right_symbol)
			)
	assert found
