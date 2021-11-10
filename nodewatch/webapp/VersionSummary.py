from zenlog import log


class VersionSummary:
    def __init__(self, tag):
        self.tag = tag
        self.count = 0
        self.power = 0
        self.node_count = 0

    def update(self, descriptor):
        self.count += 1
        self.power += descriptor.balance

    def add(self, summary):
        self.count += summary.count
        self.power += summary.power
        self.node_count += summary.node_count

    @staticmethod
    def aggregate_all(version_summaries):
        aggregate_version_summary = VersionSummary('all')
        for version_summary in version_summaries:
            aggregate_version_summary.add(version_summary)

        return aggregate_version_summary


def aggregate_descriptors(descriptors, descriptor_filter, node_descriptors, node_descriptor_filter, version_to_tag):
    version_summaries = {}

    def _get_summary(version):
        if version not in version_summaries:
            version_summaries[version] = VersionSummary(version_to_tag(version))

        return version_summaries[version]

    for descriptor in descriptors:
        if descriptor_filter and not descriptor_filter(descriptor):
            continue

        _get_summary(descriptor.version).update(descriptor)

    for node_descriptor in node_descriptors:
        if node_descriptor_filter and not node_descriptor_filter(node_descriptor):
            continue

        _get_summary(node_descriptor.version).node_count += 1

    for version, summary in version_summaries.items():
        log.debug('{}: [{}] power {} count {} node_count {}'.format(version, summary.tag, summary.power, summary.count, summary.node_count))

    return version_summaries


def group_version_summaries_by_tag(version_summaries):
    grouped_version_summaries = {}
    for version_summary in version_summaries:
        if version_summary.tag not in grouped_version_summaries:
            grouped_version_summaries[version_summary.tag] = VersionSummary(version_summary.tag)

        grouped_version_summaries[version_summary.tag].add(version_summary)

    return grouped_version_summaries
