class Screens:
	def __init__(self):
		self.ordered = []
		self.current_id = 0
		self.ordered_group_names = []
		self.group_name = []

		self.chain = []

	def add(self, screen_group_name, descriptor):
		if screen_group_name not in self.ordered_group_names:
			self.ordered_group_names.append(screen_group_name)

		self.group_name.append(screen_group_name)
		self.ordered.append(descriptor)

	def get(self, screen_id):
		index = [screen.screen_id for screen in self.ordered].index(screen_id)
		return self.ordered[index].accessor

	@property
	def current(self):
		return self.ordered[self.current_id]

	def previous(self):
		if not self.chain:
			return self.current

		self.current_id = self.chain.pop()
		return self.current

	def next(self):
		original_id = self.current_id

		next_id = self.current_id + 1
		while next_id != len(self.ordered):
			if self.ordered[next_id].should_show():
				break

			next_id = next_id + 1

		if next_id == len(self.ordered):
			return self.current

		self.chain.append(original_id)
		self.current_id = next_id

		return self.current
