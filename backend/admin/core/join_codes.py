import re
import secrets
import string

from .errors import InvalidInputError

_CODE_PATTERN = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")
_ALPHABET = string.ascii_uppercase + string.digits


def normalize_join_code(value: str) -> str:
    code = value.strip().upper()
    if not code:
        raise InvalidInputError("Join code is required.")
    if len(code) > 32 or not _CODE_PATTERN.fullmatch(code):
        raise InvalidInputError(
            "Join codes may contain letters, numbers, and hyphens between groups."
        )
    return code


def generate_join_code() -> str:
    return "ESK-" + "".join(secrets.choice(_ALPHABET) for _ in range(8))
