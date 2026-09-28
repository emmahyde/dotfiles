# Hydemods

Hydemods is a small visual registry of composable tweaks for [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi). It adds a `/hydemods` panel where you can inspect and toggle the bundled session improvements.

## Included tweaks

All of these tweaks start enabled and can be toggled from the panel:

- **Integrated tool expansion** — formats structured tool results for compact and expanded display, including syntax-colored JSON and YAML. Reads show a declaration outline of the file (tree-sitter, via the host summarizer; TypeScript, Python, Ruby, and other languages the host parses). Edits show the declarations they touched, collapsed to the tree and expanded (Ctrl+O) to the changed lines under each declaration. Command output is shown verbatim under a result heading.
- **Map tool results to TOON** — encodes structured JSON/YAML tool results as TOON before display.
- **Session identity & colors** — gives each session a persistent codename, sigil, and ANSI accent color.
- **Last prompt drawer** — shows a truncated preview of the latest prompt above the editor.
- **IRC comms & System Monitor** — enables session communication and deterministic background monitors over the IRC bus.
- **Autonomous `/heartbeat` exploration** — adds `/heartbeat` for self-directed exploration and goal-setting.
- **Interactive `/retro` summary** — adds `/retro` for a structured session retrospective.

## Install and use in OMP

One line, with [Bun](https://bun.sh) and git on your PATH:

```sh
curl -fsSL https://raw.githubusercontent.com/emmahyde/hydemods/main/install.sh | sh
```

This clones the repository into `~/.omp/agent/extensions/hydemods` (where OMP discovers directory extensions), installs its dependencies, and updates an existing checkout on re-run. Set `HYDEMODS_DIR` to install elsewhere. Then restart OMP or run `/reload-plugins`, and open `/hydemods` to view and toggle the tweaks.

To do the same by hand:

```sh
git clone https://github.com/emmahyde/hydemods.git ~/.omp/agent/extensions/hydemods
cd ~/.omp/agent/extensions/hydemods
bun install
```

The included `package.json` declares `./index.ts` through OMP's `omp.extensions` metadata.

## Development

This package uses Bun and has no build step. From the repository root:

```sh
bun install
bun run test
```

The extension imports OMP runtime modules, so load it from an OMP installation to exercise it end to end. Edit `index.ts` directly, then restart OMP (or reload the extension in your development workflow) to try changes.
