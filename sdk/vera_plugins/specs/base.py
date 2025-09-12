from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, Type, TypeVar

from esorm import ESBaseModel
from pydantic import BaseModel


class PluginBase(ABC):
    """
    Abstract base class for all plugins.
    """


class ExternalResourceMixin(ABC):
    """
    Mixin for plugins that interact with external resources.

    Provides the 'is_available' interface for checking external service
    availability.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.
    """

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass


@dataclass
class PropertyData:
    """
    Container for structured property data extracted by a plugin.

    Attributes
    ----------
    search_data : ESBaseModel
        Data intended for indexing and searching (Elasticsearch).
    detailed_data : BaseModel
        JSON-serializable data, typically for UI presentation.
    internal_data : bytes
        Raw internal data for backend use or plugin-specific processing. Could
        be used for caching, serialization, or other internal operations.
    """

    search_data: ESBaseModel
    detailed_data: BaseModel
    internal_data: bytes


@dataclass
class InputData:
    """
    Container for input data passed to property plugins.

    Attributes
    ----------
    prev_data : PropertyData or None
        Previously extracted property data, if available.
        This allows plugins to access earlier property results for incremental
        updates or context-aware processing. None if no prior data exists.
    """

    prev_data: PropertyData | None


InputDataType = TypeVar("InputDataType", bound=InputData)
OutputDataType = TypeVar("OutputDataType")


class SpecificDataPropertyPluginBase(
    PluginBase, Generic[InputDataType, OutputDataType]
):
    """
    Abstract base class for plugins that extract
    a specific property from input data.

    Designed for plugins that derive a JSON-serializable property
    from structured input.

    Type Parameters
    ---------------
    InputDataType : type
        The type of input data to parse.
    OutputDataType : type
        The type of output data produced by the plugin.
    """

    @abstractmethod
    def parse(self, input_data: InputDataType) -> OutputDataType:
        """
        Extract a property from the given input data.

        Parameters
        ----------
        input_data : InputDataType
            The input data from which to extract the property.

        Returns
        -------
        OutputDataType
            The extracted property data.
        """
        pass


class DataPropertyPluginBase(
    SpecificDataPropertyPluginBase[InputDataType, PropertyData]
):
    """
    Abstract base class for plugins that extract a property from input data.

    Designed for plugins that derive a JSON-serializable property
    from structured input.

    Type Parameters
    ---------------
    InputDataType : type
        The type of input data to parse.

    Methods
    -------
    parse(input_data: InputDataType) -> OutputDataType
        Extract a property from the given input data.
    """

    @property
    @abstractmethod
    def search_data_type(self) -> Type[ESBaseModel]:
        """
        The type of data intended for indexing and searching.

        Returns
        -------
        Type[ESBaseModel]
            The model class used for search data.
        """
        pass

    @property
    @abstractmethod
    def detailed_data_type(self) -> Type[BaseModel]:
        """
        The type of data intended for detailed representation.

        Returns
        -------
        Type[BaseModel]
            The model class used for detailed dat
        """
        pass
