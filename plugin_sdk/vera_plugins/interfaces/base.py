from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, TypeVar


class PluginBase(ABC):
    pass


class ResourcePluginBase(PluginBase):
    """
    Abstract base class for resource-based plugins.

    This class defines the interface for plugins
    that interact with external resources,
    such as databases, APIs, or other external services.

    Methods
    -------
    is_available:
        Check if the resource is available for interaction.
    get_config_schema:
        Retrieve the configuration schema or None if not available.
    """

    @abstractmethod
    def get_config_schema(self) -> Dict[str, Any] | None:
        """
        Retrieve the configuration schema for the plugin.

        This method should return a JSON-compatible dictionary describing
        the expected configuration structure for the plugin. If the plugin
        does not require configuration, it should return None.

        Returns
        -------
        Dict[str, Any] | None
            A dictionary representing the JSON schema
            of the plugin configuration, or None if no configuration is needed.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check whether the resource is available for interaction.

        This method verifies whether the external resource
        (e.g., a database or API) that the plugin
        interacts with is currently accessible and operational.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass


T = TypeVar("T")  # Input data type
R = TypeVar("R")  # Output result type


class BaseParserPlugin(PluginBase, Generic[T, R]):
    """
    Abstract base class for parser plugins.

    This class defines the interface for plugins
    that extract a specific property from the input data.

    Methods
    -------
    parse(input_data: T) -> R
        Extract a specific property from the given input data.
    """

    @abstractmethod
    def parse(self, input_data: T) -> R:
        """
        Extract a specific property from the given input data.

        Parameters
        ----------
        input_data : T
            The input data from which a property will be extracted.

        Returns
        -------
        R
            The extracted property from the input data.
        """
        pass
