# Rails Migration Expert Skill

**Triggers:** `rails-migration`, `create migration`, `gen-migration`

**Description:** Generate Rails migrations using the rails-migration-expert agent. Accepts a table/migration name and list of attributes, delegates to the expert agent, and writes the migration file directly to `db/migrate/`.

## Usage

```
rails-migration add_status_to_users status:string active:boolean
rails-migration create_posts title:string body:text user:references
rails-migration AddProfileToUsers bio:text avatar_url:string
```

## Implementation

### Handler Script

```bash
#!/bin/bash
# Rails Migration Generator Skill Handler

TABLE_NAME="${1}"
shift
ATTRIBUTES="$@"

if [[ -z "$TABLE_NAME" ]]; then
    echo "Usage: rails-migration <table_name> [attribute:type ...]"
    echo "Example: rails-migration add_status_to_users status:string active:boolean"
    exit 1
fi

RAILS_ROOT="$(pwd)"
MIGRATE_DIR="$RAILS_ROOT/db/migrate"

if [[ ! -d "$MIGRATE_DIR" ]]; then
    echo "Error: db/migrate directory not found at $RAILS_ROOT"
    exit 1
fi

# Generate timestamp (Rails convention: YYYYMMDDHHMMSS)
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Convert table name to class name
# e.g., add_status_to_users -> AddStatusToUsers
CLASS_NAME=$(echo "$TABLE_NAME" | sed -E 's/(^|_)([a-z])/\U\2/g')

MIGRATION_FILE="$MIGRATE_DIR/${TIMESTAMP}_${TABLE_NAME}.rb"

echo "Generating migration: $MIGRATION_FILE"
echo "Attributes: $ATTRIBUTES"
echo ""

# Delegate to rails-migration-expert agent
PROMPT="Generate a Rails migration with the following details:
- Migration name: $TABLE_NAME
- Class name: $CLASS_NAME
- Attributes: $ATTRIBUTES

Please create the complete, production-ready migration code.
Output ONLY the Ruby migration file content (no explanations or markdown).
Start with 'class $CLASS_NAME' and end with 'end'."

# Call claude to invoke rails-migration-expert agent
MIGRATION_CODE=$(claude --agent rails-migration-expert "$PROMPT" 2>/dev/null || echo "")

if [[ -z "$MIGRATION_CODE" ]]; then
    echo "Error: Failed to generate migration"
    exit 1
fi

# Write migration file
echo "$MIGRATION_CODE" > "$MIGRATION_FILE"

echo "✓ Migration created: $(basename $MIGRATION_FILE)"
echo ""
echo "Next steps:"
echo "  rails db:migrate"
echo ""
```

## How It Works

1. **Parse Input:** Extracts table name and attributes from command arguments
2. **Validate:** Checks that Rails project structure exists (db/migrate/)
3. **Generate Timestamp:** Creates Rails-standard migration timestamp (YYYYMMDDHHMMSS)
4. **Build Prompt:** Constructs detailed prompt with all migration requirements
5. **Delegate:** Passes to `rails-migration-expert` agent for generation
6. **Write File:** Saves migration to `db/migrate/` with proper naming convention
7. **Confirm:** Reports success and next steps

## Features

- **Auto-timestamping:** Generates Rails-standard migration filenames
- **Class name conversion:** Automatically converts snake_case to CamelCase
- **Agent delegation:** Leverages rails-migration-expert for domain expertise
- **Direct file creation:** Writes migration file directly to db/migrate/
- **Error handling:** Validates project structure before generation

## Supported Attribute Types

- `string`
- `text`
- `integer`
- `float`
- `decimal`
- `datetime`
- `date`
- `boolean`
- `references` / `references:Model`
- `json`
- `jsonb`
- `array`
- Custom types via agent instruction

## Examples

### Simple Column Addition
```
rails-migration add_status_to_users status:string
```

### Multiple Columns
```
rails-migration add_profile_to_users bio:text avatar_url:string verified:boolean
```

### Table Creation with References
```
rails-migration create_posts title:string body:text published:boolean user:references
```

### Complex Types
```
rails-migration add_metadata_to_products metadata:json pricing:decimal
```

## Integration

To use this skill with Claude Code:

1. Save handler script to `.claude/skills/rails-migration.sh`
2. Make executable: `chmod +x .claude/skills/rails-migration.sh`
3. Add to Claude Code skill registry
4. Invoke with: `rails-migration <table_name> <attributes>`

The skill automatically:
- Detects Rails project structure
- Generates proper timestamps
- Converts naming conventions
- Creates migration files in correct location
- Reports status and next steps
