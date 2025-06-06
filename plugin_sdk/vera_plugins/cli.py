from enum import Enum
from pathlib import Path
from typing import List

import typer

from vera_plugins.schemas import MetaDiscoveryResult

from .cli_schemas import (
    BaseInstanceRow,
    BaseMetaRow,
    DiscoveryInstanceRow,
    DiscoveryMetaRow,
    LintingInstanceRow,
    LintingMetaRow,
)
from .tools.discovery import discover_plugin_instances, discover_plugins
from .tools.validation import validate_instance, validate_plugin

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


def _echo_meta_rows(
    meta_rows: List[BaseMetaRow], title: str, no_results_message: str
):
    if not meta_rows:
        typer.echo(no_results_message)
        return

    meta_rows.sort(key=lambda r: (r.path, r.name, r.version), reverse=False)

    typer.echo(f"{title}:\n")
    typer.echo("\n".join(repr(row) for row in meta_rows))


def _echo_instance_rows(
    instance_rows: List[BaseInstanceRow], title: str, no_results_message: str
):
    if not instance_rows:
        typer.echo(no_results_message)
        return

    instance_rows.sort(
        key=lambda r: (r.path, r.plugin_name, r.instance_name), reverse=False
    )

    typer.echo(f"{title}:\n")
    typer.echo("\n".join(repr(row) for row in instance_rows))


@app.command()
def discover(
    plugin_location: str = PluginLocationArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Discover plugins from a directory or git repository.
    """
    _echo_meta_rows(
        [
            DiscoveryMetaRow.from_discovery(path, meta, err)
            for path, meta, err in discover_plugins(plugin_location)
        ],
        "Discovered Plugins",
        "No plugins found.",
    )

    if not include_instances:
        return

    _echo_instance_rows(
        [
            DiscoveryInstanceRow.from_discovery(path, instance, err)
            for path, instance, err in discover_plugin_instances(
                plugin_location
            )
        ],
        "Discovered Plugin Instances",
        "No plugin instances found.",
    )


@app.command()
def lint(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Lint one or more plugins.
    """
    discovered_metas = discover_plugins(plugin_location, plugin_name)

    _echo_meta_rows(
        [
            LintingMetaRow.from_discovery(
                dm.file_path,
                dm.item,
                validate_plugin(
                    dm.item.type, Path(dm.file_path) / dm.item.primary_file
                ),
            )
            for dm in discovered_metas
        ],
        "Results of Plugin Linting",
        "No plugins found.",
    )

    if not include_instances:
        return

    discovered_instances = discover_plugin_instances(
        plugin_location, plugin_name
    )

    candidate_metas = [meta.item for meta in discovered_metas if meta.item]

    _echo_instance_rows(
        [
            LintingInstanceRow.from_discovery(
                di.file_path,
                di.item,
                validate_instance(di.file_path, di.item, candidate_metas),
            )
            for di in discovered_instances
        ],
        "Results of Plugin Instance Linting",
        "No plugin instances found.",
    )


@app.command()
def describe(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
):
    discovered_metas = discover_plugins(plugin_location, plugin_name)

    if discovered_metas:
        typer.echo("No results found.")
        return

    typer.echo("Discovered Plugins:\n")

    for dm in discovered_metas:
        if dm.error:
            typer.echo(
                f"Error discovering plugin at {dm.file_path}: {dm.error}\n"
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
#     plugin_path: str = typer.Argument(...,
# help="Path or git URL to plugins"),
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
#     author: Optional[str] = typer.Option(None, "--author",
# help="Author name"),
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
