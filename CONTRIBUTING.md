# Contributing Guidelines

There are many ways to contribute to EVE Vault.

## Troubleshooting

You can help other users in the community to solve their issues in the [Discord].

[Discord]: https://discord.com/invite/evefrontier

## Opening an issue

You can [open an issue] to suggest a feature or report a minor bug.

Before opening an issue, be sure to search through the existing open and closed issues, and consider posting a comment in one of those instead.

When requesting a new feature, include as many details as you can, especially around the use cases that motivate it. Features are prioritized according to the impact they may have on the ecosystem, so we appreciate information showing that the impact could be high.

[open an issue]: https://github.com/evefrontier/evevault/issues

## Submitting a pull request

If you would like to contribute code or documentation you may do so by forking the repository and submitting a pull request.

Make sure to run linter and tests to make sure your pull request is good before submitting it.

Please keep the scope of your PR small. It's better to open multiple small PRs than one huge PR, as smaller PRs are easier to review and merge.

When opening the pull request you will be presented with a template and a series of instructions. Read through it carefully and follow all the steps. Expect a review and feedback from the maintainers afterwards.

## Code Contribution Guidelines

When contributing code to EVE Vault, please follow these guidelines:

### Architecture

Check the [Architecture ADR](https://github.com/evefrontier/architecture-decision-log/blob/main/adr/0008-zklogin-implementation-auth-flow.md) for architecture reference and design decisions.

### Tooling

This is a [Bun](https://bun.sh) + [Turborepo](https://turbo.build) monorepo. Use `bun`, not `npm` or `pnpm`.

| Task | Command |
| --- | --- |
| Install deps | `bun install` |
| Lint & format (Biome) | `bun run lint` / `bun run lint:fix` |
| Typecheck | `bun run typecheck` |
| Unit tests | `bun run test` (watch) / `bun run test:run` (CI) |

Formatting and linting are enforced by [Biome](https://biomejs.dev): single quotes, no
semicolons, 2-space indent, auto-organized imports. Use `bun run lint:fix`.

A pre-commit hook runs lint-staged; a pre-push hook runs `bun audit` and the full test suite.

### Tests

- Co-locate tests using the suffix that matches the runtime environment:
  `*.node.test.ts` for Node, `*.browser.test.ts` for browser/jsdom. Shared helpers go in `__tests__/`.
- Cover edge cases and varied inputs, not just the happy path with default values.
- New behavior must ship with tests; `bun run test:run` must pass before pushing.