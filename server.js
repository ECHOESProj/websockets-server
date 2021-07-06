const http = require('http');
const WebSocket = require('ws');
const { exec, spawn } = require('child_process');

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

const PORT = 3000;

wss.on('connection', ws => {

  ws.on('message', message => {
    message = JSON.parse(message);

    // use spawn so that args are pass in an array and are escaped
    // docker run -v /var/run/docker.sock:/var/run/docker.sock -v /data:/data eo S2_MSI_L1C ndvi_s2 "POLYGON ((-6.485367 52.328206, -6.326752 52.328206, -6.326752 52.416241, -6.485367 52.416241, -6.485367 52.328206))" 2021-01-09 2021-02-01 --cloud_cover=90
    const docker = spawn('docker', [
      'run', 
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', 'eo-vol:/data',
      '--network', 'host',
      'eo',
      message.instrument,
      message.processing_module,
      message.polygon,
      message.start,
      message.stop,
      '--cloud_cover', message.cloud_cover
    ]);
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
  console.log('token', token);
  if(token !== process.env.WEBAPIKEY) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;  
  }
  
  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws);
  });

});

console.log(`Listening on port: ${PORT}`)
server.listen(PORT);