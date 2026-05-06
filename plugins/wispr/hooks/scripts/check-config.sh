#!/bin/bash
# SessionStart hook — prompts setup if wispr-config.yml does not exist yet.

if [[ -f "$HOME/.claude/wispr-config.yml" ]]; then
  echo '{"continue": true}'
  exit 0
fi

echo '{"continue": true, "message": "Wispr plugin is installed but has not been configured. Run /wispr:setup now to configure voice settings before using /wispr:on."}'
