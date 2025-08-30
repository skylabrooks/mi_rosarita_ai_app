const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node simple-mcp-client.js <server-name> <command> [command-args]');
    process.exit(1);
  }

  const [serverName, command, commandArgsStr = '{}'] = args;
  let commandArgs;
  try {
    commandArgs = JSON.parse(commandArgsStr);
  } catch (e) {
    console.error('Error: command-args must be a valid JSON string.');
    process.exit(1);
  }


  const rcPath = path.join(__dirname, '.mcprc');
  const rcFile = fs.readFileSync(rcPath, 'utf8');
  const config = JSON.parse(rcFile);

  const serverConfig = config.mcpServers[serverName];
  if (!serverConfig) {
    console.error(`Could not find server: ${serverName}.`);
    process.exit(1);
  }

  const serverProcess = spawn(serverConfig.command, serverConfig.args, {
    env: { ...process.env, ...serverConfig.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const request = {
    jsonrpc: '2.0',
    method: `tools/${command}`,
    params: commandArgs,
    id: 1,
  };

  serverProcess.stdin.write(JSON.stringify(request) + '\n');

  serverProcess.stdout.on('data', (data) => {
    console.log(`Response from ${serverName}:`, data.toString());
    serverProcess.kill();
    process.exit(0);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Error from ${serverName}:`, data.toString());
    serverProcess.kill();
    process.exit(1);
  });

  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(`${serverName} process exited with code ${code}`);
    }
  });
}

main().catch(console.error);