# Contributing

## Releasing (maintainers only)

### Versioning

This project follows [Semantic Versioning](https://semver.org/). Pre-release tags use the format `0.1.0-rc.1`.

| Change type                       | Example             |
| --------------------------------- | ------------------- |
| Bug fix (patch)                   | `0.0.17` → `0.0.18` |
| New feature, non-breaking (minor) | `0.0.17` → `0.1.0`  |
| Breaking change (major)           | `0.1.0` → `1.0.0`   |

Use an `rc` pre-release tag (e.g. `0.1.0-rc.1`) before promoting to a stable release.

### Steps

1. Bump the version in `package.json`.
2. Commit the version bump and open a PR against `main`.
3. Once merged, tag the release, replacing `vX.Y.Z` with the version from `package.json`:
   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

Pushing the tag triggers the release workflow automatically:

- **Stable releases** (e.g. `v1.2.3`): publishes to npm and creates a GitHub release.
- **Release candidates** (e.g. `v1.2.3-rc.1`): publishes to npm under the `rc` dist-tag only.
