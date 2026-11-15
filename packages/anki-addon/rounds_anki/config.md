**server**: where Rounds lives. The add-on calls its `anki-pair` and `anki-sync` functions here.

- Your own computer while developing: `http://127.0.0.1:54321/functions/v1`
- The Rounds test server: set by the `.ankiaddon` file you were given. Leave it as it is.

The connection itself is kept per Anki profile, not here. Use Tools → Rounds to connect or disconnect.
