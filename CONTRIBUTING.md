# Contributing

## Releasing (maintainers only)

### Versioning

This project follows [Calendar Versioning](https://calver.org/) using a `YY.M.PATCH` scheme (e.g. `v26.8.0`), a SemVer-compatible variant of CalVer. npm requires `package.json` versions to be valid [SemVer](https://semver.org/), which disallows leading zeros in numeric identifiers, so `YY` is the last two digits of the year as a non-zero-padded number (e.g. `26` for 2026), `M` is the non-zero-padded month, and `PATCH` resets to `0` for the first release of a given year/month and increments for subsequent releases within that same month. Git tags are always `v`-prefixed (e.g. `v26.8.0`). Pre-release tags use the format `v26.8.0-rc.1`.

| Change type                                | Example               |
| ------------------------------------------- | --------------------- |
| Another release in the same month           | `v26.8.0` → `v26.8.1` |
| First release in a new month (same year)    | `v26.8.1` → `v26.9.0` |
| First release in a new year                 | `v26.9.0` → `v27.1.0` |

Use an `rc` pre-release tag (e.g. `v26.8.0-rc.1`) before promoting to a stable release.

### Steps

1. Bump the version in `package.json`.
2. Commit the version bump and open a PR against `main`.
3. Once merged, tag the release, replacing `vYY.M.PATCH` with the version from `package.json`. Pass `-m` so `git tag -a` doesn't open an editor:
   ```sh
   git tag -a vYY.M.PATCH -m "vYY.M.PATCH"
   git push origin vYY.M.PATCH
   ```

Pushing the tag triggers the release workflow automatically:

- **Stable releases** (e.g. `v26.8.0`): publishes to npm and creates a GitHub release.
- **Release candidates** (e.g. `v26.8.0-rc.1`): publishes to npm under the `rc` dist-tag only.
