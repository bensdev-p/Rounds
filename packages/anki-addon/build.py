"""`pnpm anki:addon:build [--hosted]`: packs the add-on into a .ankiaddon file.

A .ankiaddon is a zip of the add-on's files (no top-level folder, no caches)
plus manifest.json, installed by double-clicking it (M3.1 findings).
Without --hosted the file points at the local stack; with it, at the private
hosted project in supabase/hosting.json (rounds-dev).
"""

from __future__ import annotations

import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "rounds_anki")
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
LOCAL = "http://127.0.0.1:54321/functions/v1"


def server(hosted: bool) -> str:
    if not hosted:
        return LOCAL
    with open(os.path.join(REPO, "supabase", "hosting.json"), encoding="utf-8") as f:
        ref = json.load(f)["previewProjects"][0]
    return f"https://{ref}.supabase.co/functions/v1"


def build(hosted: bool) -> str:
    out_dir = os.path.join(HERE, "dist")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "rounds-dev.ankiaddon" if hosted else "rounds-local.ankiaddon")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(SOURCE):
            dirs[:] = [d for d in dirs if d != "__pycache__"]
            for name in files:
                if name == "meta.json" or name.endswith(".pyc"):
                    continue
                path = os.path.join(root, name)
                rel = os.path.relpath(path, SOURCE).replace(os.sep, "/")
                if rel == "config.json":
                    z.writestr(rel, json.dumps({"server": server(hosted)}, indent=2) + "\n")
                else:
                    z.write(path, rel)
        z.write(os.path.join(HERE, "manifest.json"), "manifest.json")
    return out


if __name__ == "__main__":
    path = build("--hosted" in sys.argv)
    print(f"Built {path}. Double-click it to install in Anki, then restart Anki.")
