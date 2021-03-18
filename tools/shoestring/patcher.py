from configparser import RawConfigParser


def patch_config(root, name, patch_cb, **kwargs):
    # treat comment line as values, to have them back in output
    config = RawConfigParser(comment_prefixes=None, empty_lines_in_values=False, allow_no_value=True)

    config.optionxform = lambda option: option
    filename = f'{root}/resources/config-{name}.properties'
    config.read(filename)

    patch_cb(config, **kwargs)

    with open(filename, 'wt', encoding='utf8') as output_file:
        config.write(output_file)
