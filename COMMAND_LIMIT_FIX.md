# Command Limit and Safe Registration

Discord permits at most 100 application commands in each global or guild
scope. Astrix keeps its larger command catalog grouped into subcommands and
uses the guild scope for commands that do not fit in the global scope.

This means 700+ separate top-level slash commands cannot be registered in
Discord. To expose 700+ logical actions, they must be added as grouped
subcommands or prefix commands; the exact command names and behavior are
needed before generating those actions.

Registration now reads the current Discord command list first, updates matching
Astrix definitions, and appends only while space remains. Existing commands
that Astrix did not create are preserved; the bot no longer clears guild
commands or replaces the global list with only its own definitions.

If a scope is already full, Astrix logs the command names it could not append
instead of deleting existing commands. Source definitions remain in the
project and can be registered later after a slot becomes available.