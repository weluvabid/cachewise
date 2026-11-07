# Releasing Cachewise

Cachewise releases are tag-driven. A release tag must match the version in
`packages/cachewise/package.json`; the GitHub Actions release workflow then
runs the full quality gate, publishes the package to npm, and creates a
GitHub Release with generated notes.

## One-time setup

Add an Actions repository secret named `NPM_TOKEN` with permission to publish
`@weluvabid/cachewise` to npm. The workflow requests GitHub's OIDC identity
token and publishes with npm provenance enabled.

## Release procedure

1. Add a Changeset describing the package change:

   ```sh
   pnpm changeset
   ```

2. Apply the Changeset version bump and changelog:

   ```sh
   pnpm changeset version
   ```

3. Review and commit the updated package version, changelog, and consumed
   Changeset files. Push the commit to `main`.

4. Create and push the matching version tag:

   ```sh
   VERSION="$(node -p "require('./packages/cachewise/package.json').version")"
   git tag "v${VERSION}"
   git push origin "v${VERSION}"
   ```

The tag push starts `.github/workflows/release.yml`. The workflow fails
before publishing if the tag and package version differ or any quality gate
fails. Do not reuse an existing release tag.

For the first release, the current package version can be tagged directly;
a Changeset is only needed when preparing a subsequent version.
