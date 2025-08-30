# Mi Rosarita AI App - MCP Client

This directory contains the client for interacting with the Model Context Protocol (MCP) servers.

## Setup

Before using the client, run the setup script to configure your Firebase project ID:

```bash
node setup.js
```

This will prompt you for your Firebase project ID and automatically update the `.mcprc` file.

## Usage

You can use the `mcp-client.js` script to send commands to any of the configured MCP servers.

### Syntax

```bash
node mcp-client.js <server-name> <command> [command-args]
```

-   `<server-name>`: The name of the server to interact with (e.g., `firebase-server`).
-   `<command>`: The command to execute on the server.
-   `[command-args]`: A JSON string of arguments for the command.

### Example

To query the `deals` collection from the `firebase-server`:

```bash
node mcp-client.js firebase-server firebase_firestore_query '{"collection":"deals","limit":10}'