"""Read one VPN profile's model stars for the subscription gateway's local socket."""

import json
import sqlite3
import sys
from contextlib import closing
from pathlib import Path


def read_favorites(database, email):
    with closing(sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as conn:
        row = conn.execute('SELECT settings FROM user WHERE email = ?', (email,)).fetchone()
    settings = json.loads(row[0]) if row and row[0] else {}
    ui = (settings or {}).get('ui') or {}
    stars = []
    for field in ('pinnedModels', 'nmbPinnedImageModels'):
        values = ui.get(field)
        if isinstance(values, list):
            stars.extend(value for value in values if isinstance(value, str) and value)
    return list(dict.fromkeys(stars))


if __name__ == '__main__':
    owner = json.loads(sys.stdin.buffer.readline(2048))
    if not isinstance(owner, str) or not owner:
        raise ValueError('Expected a profile identifier')
    print(json.dumps(read_favorites(Path(sys.argv[1]), owner), ensure_ascii=True))
