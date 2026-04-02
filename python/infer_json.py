"""
Read one JSON object from stdin, run ml_logic.predict, print JSON to stdout.
Used by Node (Next.js) so we avoid shell-quoting issues on Windows.
"""
from __future__ import annotations

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def json_safe(obj):
    import numpy as np

    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(x) for x in obj]
    if isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def main() -> None:
    from ml_logic import predict

    data = json.load(sys.stdin)
    out = predict(data)
    print(json.dumps(json_safe(out)), flush=True)


if __name__ == "__main__":
    main()
