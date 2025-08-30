const fs = require('fs');
const path = require('path');

async function main() {
  const { MCP } = await import('@modelcontextprotocol/sdk');
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node mcp-client.js <server-name> <command> [command-args]');
    process.exit(1);
  }

  const [serverName, command, ...commandArgs] = args;

  const rcPath = path.join(__dirname, '.mcprc');
  const rcFile = fs.readFileSync(rcPath, 'utf8');
  const config = JSON.parse(rcFile);

  const mcp = new MCP({
    servers: config.mcpServers,
  });

  await mcp.startServers();

  const server = mcp.server(serverName);

  if (server) {
    console.log(`Sending command '${command}' to ${serverName}...`);
    try {
      const response = await server.useTool(command, JSON.parse(commandArgs || '{}'));
      console.log(`Response from ${serverName}:`, response);
    } catch (error) {
      console.error(`Error executing command on ${serverName}:`, error.message);
    }
  } else {
    console.error(`Could not find server: ${serverName}.`);
  }

  await mcp.stopServers();
}

main().catch(console.error);