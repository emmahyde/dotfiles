# Obsidian config

Recreates my Obsidian setup in any vault: settings, hotkeys, graph config,
themes, snippets, the enabled-plugin set + each plugin's settings, and the
plugins themselves.

## Usage

```sh
cp secrets.example.env secrets.env   # optional: fill in ELEVEN_LABS_API_KEY
./install.sh /path/to/your/vault
```

Then restart Obsidian (or "Reload app without saving").

Requires `gh` (authenticated) and `jq`.

## What's captured

| Path | Contents |
|------|----------|
| `config/` | `app`, `appearance`, `graph`, `hotkeys`, `core-plugins`, `community-plugins`, `types` JSON — copied verbatim into `.obsidian/` |
| `plugins.tsv` | 45 enabled plugins as `id <TAB> github-repo`; reinstalled from latest releases |
| `plugin-data/<id>/data.json` | per-plugin settings, copied into each plugin folder |
| `themes/`, `snippets/` | snapshotted (Minimal, AnuPpuccin + 3 CSS snippets) |
| `vendor/folders2graph/` | locally-patched build (see below) |

## How plugins are installed

Each plugin in `plugins.tsv` is fetched from its latest GitHub release
(`main.js` + `manifest.json`, plus `styles.css` when present). This means you
get the **latest** version of each plugin, not the exact pinned version that
was installed when this was captured.

`folders2graph` is the exception: its upstream release crashes the graph view
(`Cannot read properties of undefined (reading 'links')`), so the patched build
is vendored in `vendor/` and copied in directly. Fix is upstream in
[ratibus11/folders2graph#35](https://github.com/ratibus11/folders2graph/pull/35).

## Secrets

The only plaintext secret in the config is the **eleven-labs** `apiKey`; it's
stripped from `plugin-data/` and injected at install time from `secrets.env`
(gitignored). **Copilot** keys are stored in the OS keychain, not in files, so
they aren't captured — re-enter them in Copilot settings after install.

## Not captured

`workspace.json` (window/pane layout — machine- and session-specific) and
`.DS_Store` are intentionally excluded.
