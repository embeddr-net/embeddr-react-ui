# Contributing to @embeddr/react-ui

This guide is for contributors working on the `embeddr-react-ui` package.

## Scope

- Keep this package distribution-agnostic.
- Do not hardcode Zen-only layout, routing, or workflow behavior.
- Keep backend interaction behind stable client contracts and context APIs.

## Import Boundaries

Use explicit package boundaries:

- `@embeddr/react-ui/components/ui` for base and composed UI primitives
- `@embeddr/react-ui/components/embeddr` for Embeddr-specific media components
- `@embeddr/react-ui/components/visualization` for visualization components
- `@embeddr/react-ui/hooks/plugin` for plugin-facing hooks
- `@embeddr/react-ui/hooks/distro` for shell/distro-facing hooks
- `@embeddr/react-ui/types`, `@embeddr/react-ui/context`, and `@embeddr/react-ui/lib/*` as needed

Notes:

- `@embeddr/react-ui/hooks` remains a compatibility re-export of both hook groups.
- Prefer package export paths for consumers and plugins.

## Development Commands

Run from `embeddr-react-ui`:

```bash
pnpm lint
pnpm build
pnpm test
```

## Documentation Expectations

When changing public API surface:

- Update `README.md` import examples and relevant sections.
- Ensure guidance matches `package.json` exports.

## Release Hygiene (Package Slice)

Before cutting or handing off a release candidate:

- Lint passes with no errors
- Build emits declarations and `dist` output cleanly
- Tests pass
- README guidance matches current exports

## Related Repos

- Frontend consumer: https://github.com/embeddr-net/embeddr-frontend
- CLI and wider project docs: https://github.com/embeddr-net/embeddr-cli
- Docs portal: https://docs.embeddr.net
