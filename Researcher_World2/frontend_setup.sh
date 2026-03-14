# Navigare nella directory frontend
cd agent-laboratory-v2/frontend

# Inizializzare un progetto React con TypeScript
npx create-react-app . --template typescript

# Installare Phaser e altre dipendenze
npm install phaser@3.55.2 
npm install axios socket.io-client
npm install @reduxjs/toolkit react-redux

# Creare il file HTML di base
cat > public/index.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Agent Laboratory - Federated Learning Simulator" />
    <title>Agent Laboratory</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOL
