from abc import ABC, abstractmethod
from typing import Generic, NamedTuple, Type, TypeVar

from esorm import ESBaseModel
from pydantic import BaseModel


class PluginBase(ABC):
    """
    Abstract base class for all plugins.
    """


class ExternalResourceMixin(PluginBase):
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


class PropertyData(NamedTuple):
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


class InputData(NamedTuple):
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


class DataPropertyPluginBase(PluginBase, Generic[InputDataType]):
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
    parse(input_data: InputDataType) -> PropertyData
        Extract a property from the given input data.
    """

    @abstractmethod
    def parse(self, input_data: InputDataType) -> PropertyData:
        """
        Extract a property from the given input data.

        Parameters
        ----------
        input_data : InputDataType
            The input data from which to extract the property.

        Returns
        -------
        PropertyData
            The extracted property data, which includes search data,
            detailed data, and internal data.
        """
        pass

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
