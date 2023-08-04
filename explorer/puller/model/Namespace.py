class Namespace:
    def __init__(self, root_namespace, owner, registered_height, expiration_height, sub_namespaces):
        """Create RootNamespace model."""

        # pylint: disable=too-many-arguments

        self.root_namespace = root_namespace
        self.owner = owner
        self.registered_height = registered_height
        self.expiration_height = expiration_height
        self.sub_namespaces = sub_namespaces

    def __eq__(self, other):
        return isinstance(other, Namespace) and all([
            self.root_namespace == other.root_namespace,
            self.owner == other.owner,
            self.registered_height == other.registered_height,
            self.expiration_height == other.expiration_height,
            self.sub_namespaces == other.sub_namespaces
        ])
