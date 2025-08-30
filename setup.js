const fs = require('fs');
const path = require('path');

const projectId = process.argv;

if (!projectId) {
  console.error('Please provide a Firebase project ID as an argument.');
  process.exit(1);
}

const rcPath = path.join(__dirname, '.mcprc');

fs.readFile(rcPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading .mcprc file:', err);
    return;
  }

  const config = JSON.parse(data);

  config.mcpServers['firebase-server'].env.FIREBASE_PROJECT_ID = projectId;

  fs.writeFile(rcPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing to .mcprc file:', err);
    } else {
      console.log('Successfully updated .mcprc with your Firebase project ID.');
    }
  });
});