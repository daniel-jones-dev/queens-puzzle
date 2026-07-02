# Puzzle formats

## Text format

Used by the CLI (`--file` flag). An *n*-line file where each line has *n* characters. Each character
is a letter identifying the region that cell belongs to; cells sharing a letter belong to the same
region. For example:

```
ppppppp
ooopppb
ggggggb
ggggwww
grggwww
gggywww
gggywww
```

Implemented in `core/src/io/text.rs`.

## Archived JSON format

The JSON used by the [LinkedIn Queens](https://www.archivedqueens.com/) archive. A list of puzzles,
each with an `id`, a `regions` grid (region id per cell), and the solution `grid`:

```json
[{ "id": 353, "date": "2025/04/18",
   "grid":    [[1,0,0,0,0,0,0], ...],
   "regions": [[0,0,0,0,0,0,1], ...] }]
```

Only `id` and `regions` are used; `grid` is ignored. Region ids are remapped internally, so
non-contiguous numbering is handled. Pass with `--archive` to the CLI.

Implemented in `core/src/io/json.rs`.

## Canonical JSON format

The interchange format used by the WASM API, the web UI (state persistence, URL sharing,
import/export), and the CLI's `--json` flag.

```json
{
  "name":    "Wednesday's Puzzle",
  "source":  "Daniel Jones",
  "date":    "2026-06-29",
  "regions": [[0, 0, 1, 1], [0, 2, 1, 1], ...],
  "states":  [[0, 0, 0, 0], [0, 1, 2, 0], ...]
}
```

- `name` — human-readable puzzle title (optional).
- `source` — attribution / author (optional).
- `date` — ISO 8601 date the puzzle was created or generated, e.g. `"2026-06-29"` (optional).
- `regions[row][col]` — 0-based region index, or `null` for an unassigned cell (editor mode only).
- `states[row][col]` — `0` Unknown, `1` Queen, `2` Empty.
- `states` is omitted when all cells are Unknown (i.e. an unsolved puzzle with no progress).
- `n` is inferred from `regions.length`; the board is always square.
- All optional fields are omitted when not set; the solver and generator do not emit them.

Implemented in `core/src/io/json.rs`.
