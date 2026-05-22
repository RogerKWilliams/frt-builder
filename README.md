# FRT Builder — Future Reality Tree

Browser-based Future Reality Tree builder for Theory of Constraints practitioners.
Part of the [TP Tool Suite](https://tp-tools-suite.vercel.app) — a set of tools
covering Scheinkopf's Thinking Process methodology.

**Live tool:** https://frt-builder.vercel.app

## What it does

FRT Builder helps you test whether a proposed injection will produce the
desired effects. Nodes represent entities, desired effects, and potential
negative branches; edges represent sufficient-cause "if-then" reasoning that
projects how the system will behave once the injection is in place.

## Privacy

Your work is stored only in your browser's local storage. Nothing is sent to
any server. Use Export to back up your work to JSON files.

## Local development

```bash
npm install
npm run dev      # Vite dev server
npm test         # Run test suite (vitest)
npm run build    # Production build to dist/
```

Requires Node 20+.

## Deployment

This repo is configured for Vercel deployment. Push to the main branch and
Vercel auto-builds and deploys to https://frt-builder.vercel.app.

## License

MIT — see [LICENSE](./LICENSE).

## About

Personal educational project by Roger Williams. Not affiliated with Gartner;
views are my own. Shared as-is for educational use. Issues welcome via GitHub;
no support timeline is promised.
