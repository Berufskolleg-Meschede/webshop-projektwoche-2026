# Contributing

Thanks for helping with the BKM Webshop. This is a school project, so changes are kept small and easy to review.

## Setup

Setup and the npm scripts are described in the [README](./README.md) and in [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md). Node.js 22.22 or newer is required (CI uses 24).

## Quality gates

Before opening a pull request, these four commands must pass. CI runs the same checks.

```bash
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` fixes formatting. New code needs tests, and the coverage thresholds in `vite.config.ts` are enforced in CI.

## Branches and commits

Name branches after the work, for example `fix/123-short-description`. Write commit messages as a single line in English, in the imperative mood, using the format `type(scope): subject`, for example `fix(ui): correct the cart total`.

## Pull requests

Open pull requests against `main` and link the issue in the description with `Closes #<issue>`. Merge only when CI is green.

## Dependencies

Do not add new dependencies without agreeing on it first. Open an issue or ask in the pull request before adding a package.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).
