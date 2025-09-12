import re
from typing import List

import typer

from ..definitions.patterns import VERSION_PATTERN
from .schemas import BaseInstanceRow, BaseMetaRow

PluginLocationArgument = typer.Argument(
    ..., help="Path or git URL to plugins (local directory or git repository)"
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


def echo_meta_rows(
    meta_rows: List[BaseMetaRow], title: str, no_results_message: str
):
    if not meta_rows:
        typer.echo(no_results_message)
        return

    meta_rows.sort(key=lambda r: (r.path, r.name, r.version), reverse=False)

    typer.echo(f"{title}:\n")
    typer.echo("\n".join(repr(row) for row in meta_rows))


def echo_instance_rows(
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


def validate_version(version: str) -> str:
    if not re.match(VERSION_PATTERN, version):
        raise typer.BadParameter(
            f"Version '{version}' does not match pattern "
            "X.Y.Z or X.Y.Z-suffix"
        )
    return version


def validate_entrypoint(value: str) -> str:
    if not value.endswith(".py"):
        raise typer.BadParameter("Entrypoint must be a file ending with '.py'")
    return value


def validate_json_schema(value: str) -> str | None:
    if value is None or value == "None":
        return None
    if not value.endswith(".schema.json"):
        raise typer.BadParameter(
            "Config schema must be a JSON file ending with '.schema.json'"
        )
    return value
