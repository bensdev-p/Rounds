"""HTTP calls to PimpMe's Edge Functions (M3.3). Standard library only.

The add-on never holds a Supabase key: it sends the one-time code to
`anki-pair`, then its device token to `anki-sync` in `x-rounds-device`.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

USER_AGENT = "RoundsAnki/0.1"


class RoundsError(Exception):
    """Something the student should read, from PimpMe or about reaching it."""


class NotConnected(RoundsError):
    """The device token is unknown: disconnected from the app, or replaced."""


class Client:
    def __init__(self, server: str, timeout: float = 30.0, opener: Any = None) -> None:
        self.server = server.rstrip("/")
        self.timeout = timeout
        self._open = opener or urllib.request.urlopen

    def _post(self, function: str, body: dict[str, Any], token: str | None = None) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", "User-Agent": USER_AGENT}
        if token:
            headers["x-rounds-device"] = token
        request = urllib.request.Request(
            f"{self.server}/{function}",
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with self._open(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                message = json.loads(e.read().decode("utf-8")).get("error")
            except Exception:
                message = None
            if e.code == 401 and token:
                raise NotConnected(message or "This Anki is not connected to PimpMe.") from e
            raise RoundsError(message or f"Rounds answered with error {e.code}.") from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise RoundsError("Couldn't reach Rounds. Check your internet connection.") from e

    def claim(self, code: str) -> str:
        token = self._post("anki-pair", {"op": "claim", "code": code}).get("token")
        if not isinstance(token, str):
            raise RoundsError("Rounds sent an unexpected answer. Try again.")
        return token

    def pull(self, token: str) -> dict[str, Any]:
        return self._post("anki-sync", {"op": "pull"}, token)

    def push(self, token: str, cards: list[dict[str, Any]], applied: list[dict[str, Any]]) -> dict[str, Any]:
        return self._post("anki-sync", {"op": "push", "cards": cards, "applied": applied}, token)

    def disconnect(self, token: str) -> None:
        self._post("anki-sync", {"op": "disconnect"}, token)
