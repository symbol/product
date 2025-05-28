from prompt_toolkit.formatted_text import StyleAndTextTuples
from prompt_toolkit.utils import get_cwidth
from prompt_toolkit.widgets import Button


class ButtonMb(Button):
	"""Button for multibyte character strings"""

	def _get_text_fragments(self) -> StyleAndTextTuples:
		super_fragments = super()._get_text_fragments()

		# Adjust centering for multibyte character strings
		width = self.width - (
			get_cwidth(self.left_symbol) + get_cwidth(self.right_symbol)
		)
		label_width = get_cwidth(self.text)
		pad_left = (width - label_width) // 2
		pad_right = width - label_width - pad_left
		text = ' ' * pad_left + self.text + ' ' * pad_right

		# Replace button text
		new_fragments = []
		for frag in super_fragments:
			if len(frag) == 3:
				style, frag_text, handler = frag
				if style == "class:button.text":
					new_fragments.append((style, text, handler))
				else:
					new_fragments.append((style, frag_text, handler))

		return new_fragments
