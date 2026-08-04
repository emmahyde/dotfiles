# Ad-hoc and saved chains

Use this workflow when two or more related MCP calls can execute inside one
sandbox and only a digest should return to context.

## Procedure

1. Identify the inputs and the smallest output that answers the task.
2. Choose Ruby, Python, or JavaScript. These runtimes receive baked
   `forward`/`emit` helpers and parsed `args`. Shell is raw: it receives the args
   JSON on stdin and must call `mcx forward` itself.
3. Run the script source from a quoted heredoc. Keep reduction, joining,
   aggregation, and filtering inside it:

   ```sh
   mcx run '{"jiraServer":"jira","cloudId":"00000000-0000-0000-0000-000000000000","keys":["PROJ-123","PROJ-124"]}' ruby <<'RUBY'
   # Fetch issue statuses and return a compact table.
   rows = args["keys"].map do |key|
     issue = forward(
       args["jiraServer"],
       "getJiraIssue",
       { "cloudId" => args["cloudId"], "issueIdOrKey" => key }
     )
     { key: issue["key"], status: issue.dig("fields", "status", "name") }
   end
   emit({ count: rows.length, issues: rows })
   RUBY
   ```

4. Inspect the digest. Revise and rerun if it contains raw payloads or omits the
   requested answer.
5. Leave no file or registry entry behind. If the user asks to persist the
   proven workflow, invoke `/mcx:save`.

## Runtime contract

Ruby, Python, and JavaScript scripts receive:

- `forward(server, tool, args = {})`: call an MCP tool and parse its JSON text
  result, raising on tool errors.
- `emit(obj)`: print the final digest. Emit once at the end.
- `args`: parsed JSON from the first `mcx run` operand.

The sandbox strips credentials and unrelated environment variables. Pass task
inputs through `--args`; let `forward` obtain authentication through mcx.

Do not redefine the baked helpers, read stdin manually, print full responses,
or persist the script merely because it was useful once.
