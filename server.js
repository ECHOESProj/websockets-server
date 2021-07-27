const http = require('http');
const WebSocket = require('ws');
const { exec, spawn } = require('child_process');

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

const PORT = 3000;

const allowedDockerImages = ['eo', 'eom'];

wss.on('connection', ws => {

  ws.on('message', message => {
    message = JSON.parse(message);
    console.log(JSON.stringify(message, null, 2));

    // use spawn so that args are pass in an array and are escaped
    const args = [
      'run',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      //'-v', 'eo-vol:/data',
      '--network', 'host',
      allowedDockerImages.find(v => v === message.image) || 'invalid',
      message.instrument,
      message.processing_module,
      message.polygon,
      message.start,
      message.end
    ];

    if (message.optional) {
      for (const entries of Object.entries(message.optional)) {
        args.push(...entries);
      }
    }

    const docker = spawn('docker', args);
    let stdout = '';
    let stderr = '';

    docker.stdout.on('data', (data) => {
      stdout += data;
    });

    docker.stderr.on('data', (data) => {
      stderr += data;
    });

    docker.on('close', code => {
      console.log(`child process exited with code ${code}`);

      if (code == 0) {
        const output = stdout.split('\n')
          .filter(s => s.startsWith('s3-location: '))
          .map(s => s.replace('s3-location: ', '').split(' '))
          .map(([bucket, key]) => ({ bucket, key }));

        ws.send(JSON.stringify({
          success: true,
          output
        }));

      } else {
        ws.send(JSON.stringify({
          success: false,
          stderr
        }));
        console.log(stderr);
      }

    });

  });

});

server.on('upgrade', function upgrade(request, socket, head) {

  // make better, add accounts?
  const token = new URL(request.url, 'https://dummyurl.com').searchParams.get('token');
  if (token !== process.env.WEBAPIKEY) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws);
  });

});

server.on('request', function request(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('health');
  res.end();
});

console.log(`Listening on port: ${PORT}`);
console.log('process.env.WEBAPIKEY', process.env.WEBAPIKEY)
server.listen(PORT);