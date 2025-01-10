from fastapi.responses import JSONResponse


def CreateResponse(item: str) -> JSONResponse:
    return JSONResponse(content={"message": f"{item} created successfully"})


def UpdateResponse(item: str) -> JSONResponse:
    return JSONResponse(content={"message": f"{item} updated successfully"})


def DeleteResponse(item: str) -> JSONResponse:
    return JSONResponse(
        content={"message": f"{item} deleted successfully"}, status_code=204
    )


def ErrorResponse(status: int, message: str) -> JSONResponse:
    return JSONResponse(content={"message": message}, status_code=status)
