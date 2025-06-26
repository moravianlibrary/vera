from pydantic import BaseModel, Field, model_validator


class TaskScheduleParams(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    minute: int = Field(..., ge=0, le=59)
    hour: int | None = Field(None, ge=0, le=23)
    day_of_week: int | None = Field(
        None, ge=0, le=6, description="0 for Sunday, 6 for Saturday"
    )
    day_of_month: int | None = Field(None, ge=1, le=31)
    month: int | None = Field(None, ge=1, le=12)

    @model_validator(mode="after")
    def validate_schedule(
        cls, model: "TaskScheduleParams"
    ) -> "TaskScheduleParams":
        if model.day_of_week and model.day_of_month:
            raise ValueError(
                "Cannot specify both day_of_week and day_of_month. "
                "Choose one for scheduling."
            )

        return model


class TaskItemsFilterParams(BaseModel):
    pass


class Task(BaseModel):
    pass


class TaskItem(BaseModel):
    pass


class ScheduledTask(BaseModel):
    pass
