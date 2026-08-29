class OntoNexusError(Exception):
    """Base exception for OntoNexus application"""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class OntologyValidationError(OntoNexusError):
    def __init__(self, message: str):
        super().__init__(message, "ONTOLOGY_VALIDATION_ERROR")


class ActionExecutionError(OntoNexusError):
    def __init__(self, message: str):
        super().__init__(message, "ACTION_EXECUTION_ERROR")


class PermissionDeniedError(OntoNexusError):
    def __init__(self, message: str):
        super().__init__(message, "PERMISSION_DENIED")
