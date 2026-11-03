# Shared domain cases

Each JSON file records inputs, expected output, and the rule ID for one exported domain function.
The Bun tests read these files now; the backend's JUnit tests will read the same files. A rule
changed in TypeScript changes its cases, keeping the Java port in step. Inputs are plain JSON: a
`Date` is an ISO string and a `Set` is an array. The runner converts date arguments and compares
set results as sorted arrays.

An optional top-level `base` object supplies fields shared by partial inputs. For status cases, the
runner merges each input iteration over this base iteration; each input only needs the fields it
changes.

A runner adapter turns lookup tables into callbacks and projects results to the values compared in cases. The backend's runner does the same.
