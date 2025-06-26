from fastapi import Request


def get_identity_provider(request: Request):
    return request.app.state.identity_provider


def get_catalog_adapter(request: Request):
    return request.app.state.catalog_adapter
