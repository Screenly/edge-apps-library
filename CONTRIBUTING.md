# Contributing

## Releasing

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
3. Once merged, authenticate with the npm registry (requires Node.js/npm, or set your token directly in `~/.npmrc` as `//registry.npmjs.org/:_authToken=YOUR_TOKEN`):
   ```sh
   npm login
   ```
4. Publish the package. For release candidates, use `--tag rc` to avoid overwriting the `latest` dist-tag:
   ```sh
   bun publish --tag rc
   ```
   For stable releases:
   ```sh
   bun publish
   ```
5. Tag the release, replacing `vX.Y.Z` with the version from `package.json`:
   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. Create a GitHub release from the tag.
