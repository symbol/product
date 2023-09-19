class Mosaic:
    def __init__(
            self,
            namespace_name,
            description,
            creator,
            registered_height,
            initial_supply,
            total_supply,
            divisibility,
            supply_mutable,
            transferable,
            levy_type,
            levy_namespace_name,
            levy_fee,
            levy_recipient
    ):
        """Create Mosaic model."""

        # pylint: disable=too-many-arguments

        self.namespace_name = namespace_name
        self.description = description
        self.creator = creator
        self.registered_height = registered_height
        self.initial_supply = initial_supply
        self.total_supply = total_supply
        self.divisibility = divisibility
        self.supply_mutable = supply_mutable
        self.transferable = transferable
        self.levy_type = levy_type
        self.levy_namespace_name = levy_namespace_name
        self.levy_fee = levy_fee
        self.levy_recipient = levy_recipient

    def __eq__(self, other):
        return isinstance(other, Mosaic) and all([
            self.namespace_name == other.namespace_name,
            self.description == other.description,
            self.creator == other.creator,
            self.registered_height == other.registered_height,
            self.initial_supply == other.initial_supply,
            self.total_supply == other.total_supply,
            self.divisibility == other.divisibility,
            self.supply_mutable == other.supply_mutable,
            self.transferable == other.transferable,
            self.levy_type == other.levy_type,
            self.levy_namespace_name == other.levy_namespace_name,
            self.levy_fee == other.levy_fee,
            self.levy_recipient == other.levy_recipient
        ])
