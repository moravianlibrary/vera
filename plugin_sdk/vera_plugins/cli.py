import json
from enum import Enum
from pathlib import Path

import pandas as pd
import typer
import yaml

from .cli_schemas import (
    DiscoveryInstanceRow,
    DiscoveryMetaRow,
    LintingInstanceRow,
    LintingMetaRow,
)
from .definitions import PluginNotFoundError
from .tools.discovery import discover_plugin_instances, discover_plugins
from .tools.validation import validate_instance, validate_plugin

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


app = typer.Typer(help="vera-plugins CLI tool")


PluginLocationArgument = typer.Argument(
    ...,
    help="Path or git URL to plugins (local directory or git repository)",
)

PluginNameArgument = typer.Argument(
    None,
    help="Specific plugin name to operate on "
    "(if not provided, all plugins will be used)",
)

IncludeInstancesOption = typer.Option(
    False,
    "--include-instances",
    "-i",
    help="Also process plugin instances in the specified location",
)


class OutputFormat(str, Enum):
    Table = "table"
    JSON = "json"
    YAML = "yaml"


OutputFormatOption = typer.Option(
    case_sensitive=False,
    show_default=True,
    default=OutputFormat.Table,
    help="Output format for results",
)


@app.command()
def discover(
    plugin_location: str = PluginLocationArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Discover plugins from a directory or git repository.
    """
    metas_df = pd.DataFrame(
        [
            DiscoveryMetaRow.from_discovery(path, meta, err).model_dump()
            for path, meta, err in discover_plugins(plugin_location)
        ]
    ).sort_values(
        by=["path", "name", "version"], ascending=[True, True, False]
    )

    if not metas_df.empty:
        typer.echo("Discovered Plugins:")
        typer.echo(metas_df.to_markdown(index=False))

    if not include_instances:
        if metas_df.empty:
            typer.echo("No results found.")
        return

    instances_df = pd.DataFrame(
        [
            DiscoveryInstanceRow.from_discovery(
                path, instance, err
            ).model_dump()
            for path, instance, err in discover_plugin_instances(
                plugin_location
            )
        ]
        if include_instances
        else []
    ).sort_values(by=["path", "plugin_name", "instance_name"])

    if not instances_df.empty:
        typer.echo("Discovered Plugin Instances:")
        typer.echo(instances_df.to_markdown(index=False))

    if metas_df.empty and instances_df.empty:
        typer.echo("No results found.")


@app.command()
def lint(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Lint one or more plugins.
    """
    discovered_metas = discover_plugins(plugin_location)

    if plugin_name:
        discovered_metas = [
            dm
            for dm in discovered_metas
            if dm.item and dm.item.name == plugin_name
        ]

    results_df = pd.DataFrame(
        (
            dm.model_dump()
            if dm.error
            else LintingMetaRow.from_discovery(
                dm.file_path,
                dm.item,
                validate_plugin(
                    dm.item.type, Path(dm.file_path) / dm.item.primary_file
                ),
            ).model_dump()
        )
        for dm in discovered_metas
    ).sort_values(
        by=["path", "name", "version"], ascending=[True, True, False]
    )

    if not results_df.empty:
        typer.echo("Linting Plugins Results:\n")

        headers = list(results_df.columns)

        for row in results_df.to_dict(orient="records"):
            typer.echo(
                " | ".join(
                    f"{h}: {row.get(h, '')}" for h in headers if h != "errors"
                )
            )

            errors = row.get("errors") or []
            if errors:
                typer.echo("  Errors:")
                for err in errors:
                    typer.echo(f"  [X] NOK - {err}")
            else:
                typer.echo("  [✓] OK")

            typer.echo("")

    if not include_instances:
        if results_df.empty:
            typer.echo("No results found.")
        return

    discovered_instances = discover_plugin_instances(plugin_location)

    if plugin_name:
        discovered_instances = [
            di
            for di in discovered_instances
            if di.item and di.item.plugin_name == plugin_name
        ]

    candidate_metas = [meta.item for meta in discovered_metas if meta.item]

    instances_df = pd.DataFrame(
        (
            di.model_dump()
            if di.error
            else LintingInstanceRow.from_discovery(
                di.file_path,
                di.item,
                validate_instance(di.file_path, di.item, candidate_metas),
            ).model_dump()
        )
        for di in discovered_instances
    ).sort_values(by=["path", "plugin_name", "instance_name"])

    if instances_df.empty:
        typer.echo("No results found.")
        return

    typer.echo("Linting Plugin Instances Results:\n")

    headers = list(results_df.columns)

    for row in results_df.to_dict(orient="records"):
        typer.echo(
            " | ".join(
                f"{h}: {row.get(h, '')}" for h in headers if h != "error"
            )
        )

        err = row.get("error")
        if err:
            typer.echo(f"  [X] NOK - {err}")
        else:
            typer.echo("  [✓] OK")


@app.command()
def describe(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
):
    discovered_metas = discover_plugins(plugin_location)
    if plugin_name:
        discovered_metas = [
            dm
            for dm in discovered_metas
            if dm.item and dm.item.name == plugin_name
        ]

    if discovered_metas:
        typer.echo("No results found.")
        return

    typer.echo("Discovered Plugins:\n")

    for dm in discovered_metas:
        if dm.error:
            typer.echo(
                f"Error discovering plugin at {dm.file_path}: {dm.error}"
            )
            continue

        typer.echo(f"{repr(dm.item)}\n")


@app.command()
def test(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
    format: OutputFormat = OutputFormatOption,
):
    discovered_metas = discover_plugins(plugin_location)
    if plugin_name:
        discovered_metas = [
            dm
            for dm in discovered_metas
            if dm.item and dm.item.name == plugin_name
        ]

    if discovered_metas:
        typer.echo("No results found.")
        return

    typer.echo("Discovered Plugins:\n")

    for dm in discovered_metas:
        if dm.error:
            typer.echo(
                f"Error discovering plugin at {dm.file_path}: {dm.error}"
            )
            continue


# @app.command()
# def package(
#     plugin_path: str = typer.Argument(..., help="Path or git URL to plugins"),
#     plugin_name: Optional[str] = typer.Argument(
#         None, help="Specific plugin name to package"
#     ),
#     output_path: Optional[str] = typer.Argument(
#         None, help="Directory to output package(s)"
#     ),
# ):
#     """
#     Package plugin(s) into distributable archives.
#     """
#     plugin_path = parse_plugin_path(plugin_path)
#     output_path = output_path or "."
#     typer.echo(
#         f"Packaging plugin(s) in {plugin_path} "
#         f"{'for ' + plugin_name if plugin_name else 'all plugins'} "
#         f"into {output_path}"
#     )


# @app.command()
# def init(
#     target_dir: Optional[str] = typer.Argument(
#         None, help="Target directory for new plugin"
#     ),
#     non_interactive: bool = typer.Option(
#         False, "--non-interactive", help="Run without prompts"
#     ),
#     name: Optional[str] = typer.Option(None, "--name", help="Plugin name"),
#     type_: Optional[str] = typer.Option(None, "--type", help="Plugin type"),
#     version: Optional[str] = typer.Option(
#         None, "--version", help="Plugin version"
#     ),
#     author: Optional[str] = typer.Option(None, "--author", help="Author name"),
#     with_boilerplate: bool = typer.Option(
#         False, "--with-boilerplate", help="Include example code"
#     ),
# ):
#     """
#     Initialize a new plugin project.
#     """
#     target_dir = target_dir or "."
#     typer.echo(f"Initializing new plugin in {target_dir}")

#     if non_interactive:
#         # Use provided options or defaults without prompting
#         typer.echo(f"Non-interactive mode")
#         typer.echo(f"Name: {name}")
#         typer.echo(f"Type: {type_}")
#         typer.echo(f"Version: {version}")
#         typer.echo(f"Author: {author}")
#         typer.echo(f"With boilerplate: {with_boilerplate}")
#         # TODO: Create files accordingly
#     else:
#         # Interactive prompts for any missing info
#         if not name:
#             name = typer.prompt("Plugin name")
#         if not type_:
#             type_ = typer.prompt("Plugin type")
#         if not version:
#             version = typer.prompt("Plugin version")
#         if not author:
#             author = typer.prompt("Author name", default="")
#         # TODO: Create files accordingly

#     typer.echo(f"Plugin '{name}' initialized successfully.")


def main():
    app()


if __name__ == "__main__":
    main()
