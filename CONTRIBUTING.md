# Contributing to @vandrite/nspell

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to `@vandrite/nspell`, which is hosted in the [Vandrite Organization](https://github.com/vandrite) on GitHub.

## Project Structure

This project is a TypeScript rewrite of `nspell`, optimized for performance.

- `src/` - Source code
  - `util/` - Core logic (DAWG, Suggestions, etc.)
  - `index.ts` - Main entry point
- `test/` - Unit tests
- `benchmark/` - Performance benchmarks

## Getting Started

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    # or
    bun install
    ```

## Development Workflow

### specific scripts

- **Build**: `npm run build`
- **Test**: `npm test`
- **Lint**: `npm run lint`
- **Format**: `npm run format`
- **Benchmark**: `npm run benchmark`

### Making Changes

1.  Create a branch for your feature or fix: `git checkout -b feature/amazing-feature`
2.  Make your changes.
3.  **Run tests** to ensure no regressions: `npm test`
4.  **Run benchmarks** if you modified core logic (DAWG, Suggestions) to check for performance impacts: `npm run benchmark`
5.  Commit your changes using conventional commits (e.g., `feat: add new feature`, `fix: resolve crash`).

## Pull Request Process

1.  Push your branch to GitHub.
2.  Open a Pull Request against the `main` branch.
3.  Ensure all CI checks pass (Tests, Lint, Build).
4.  Provide a clear description of your changes and why they are necessary.

## Code Style

- We use **Prettier** for formatting. Run `npm run format` before committing.
- We use **ESLint** for linting. Fix any errors reported by `npm run lint`.
- Use TypeScript functionality where possible (interfaces, types) instead of `any`.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
