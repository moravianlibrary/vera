# vera-plugins functionality:

# Common Input:
# plugin_path can be:
#   - a local directory containing one or more vera-plugin.yaml files
#   - a git repository URL (http/https) with a vera-plugin.yaml file at root or in subdirectories
#   - a git repository URL with optional branch and subdirectory (e.g., https://...@branch:subdir)
#
# Common Flags:
#   --format json|yaml|table  # output format for results (default: table where applicable)

# ------------------------------------------------------------------------------
# Command: vera-plugins discover {plugin_path}
# - Discover plugins from a directory or git repository.
# - Return basic metadata for each discovered plugin.
# - Output fields (per plugin):
#     - plugin_path
#     - plugin_name
#     - plugin_type
#     - plugin_version

# ------------------------------------------------------------------------------
# Command: vera-plugins lint {plugin_path} [plugin_name]
# - Lint one or more plugins in the given path.
# - If plugin_name is specified, only lint that plugin; otherwise lint all found plugins.
# - Optionally supports:
#     --meta-only       # only validate the vera-plugin.yaml file (skip code checks)
# - Output structure:
#     - header with plugin properties
#     - list of linting issues:
#         - severity (info/warning/error)
#         - message or description
#         - source (yaml/code)

# ------------------------------------------------------------------------------
# Command: vera-plugins describe {plugin_path} [plugin_name]
# - Provide a detailed description of one or more plugins.
# - If plugin_name is specified, only describe that plugin; otherwise describe all found plugins.
# - Output (per plugin):
#     - plugin_path
#     - plugin_name
#     - plugin_type
#     - plugin_version
#     - plugin_description
#     - plugin_author
#     - implemented_features

# ------------------------------------------------------------------------------
# Command: vera-plugins test {plugin_path} [plugin_name] [data]
# - Test a plugin using a provided or default data set.
# - If plugin_name is specified, only test that plugin.
# - If data is provided, use it as input for the plugin's test run.
# - If no data is provided, use default test data (defined per plugin type).
# - Notes:
#     - Some plugins may not require input data.
#     - Data format may vary by plugin type.
# - Output structure:
#     - header with plugin properties
#     - list of test cases and their results (e.g., passed/failed + output/diagnostics)

# ------------------------------------------------------------------------------
# Command: vera-plugins package {plugin_path} [plugin_name] [output_path]
# - Package a plugin into a distributable archive (.zip).
# - If plugin_name is not specified packages all plugins in the path
# - If plugin_name is specified, only package that plugin.
# - If output_path is not specified, default to current directory.
# - output_path should be a valid directory where the package will be created.
# - The naming convention for the package file is `{plugin_name}-{version}.zip`.
# - Output:
#     - Path to the created package file

# ------------------------------------------------------------------------------
# Command: vera-plugins init [target_dir]
# - Initialize a new plugin project in the specified target directory.
# - Take the user through a guided setup to create the necessary files:
#   - Choose a plugin name
#   - Choose a plugin type
#   - Choose a plugin version
# - Optional flags:
#   - --non-interactive
#   - --name <plugin_name>
#   - --type <plugin_type>
#   - --version <plugin_version>
#   - --author <author_name>
#   - --with-boilerplate


def main():
    print("Hello from vera-plugins!")
