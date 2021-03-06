'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const root = require('window-or-global');
const detectPort = require('detect-port');
const mockData = require('macaca-reporter/test/mock');
const macacaReporterRender = require('macaca-reporter/lib/render');

const _ = require('../common/helper');

let server = require('http').createServer();
let io = require('socket.io')(server);
let socketed = false;
let connected = false;

module.exports = function(app) {

  app.use(function *() {

    if (socketed) {
      /** Update content */
      this.body = fs.readFileSync(path.join(__dirname, '..', '..', 'reports', 'index.html'), 'utf8');
      return;
    } else {
      socketed = true;
    }

    var port = yield detectPort(56788);

    /** Listen to port and update change */
    server.listen(port);
    io.on('connection', function(socket) {
      if (connected === false) {
        connected = true;
        console.log('socket connected');
        setInterval(() => {
          io.sockets.emit('update reporter', mockData);
        }, 2000);

        socket.on('disconnect', function() {});
      }
    });

    /** Update content */
    this.body = fs.readFileSync(path.join(__dirname, '..', '..', 'reports', 'index.html'), 'utf8');

    /** Detect port and render data */
    macacaReporterRender(mockData, {
      socket: {
        server: `http://${_.ipv4}:${port}`
      }
    });
  });
};

/** Add event emmiter for picking up changes */
if (!root.eventEmmiter) {
  root.eventEmmiter = new EventEmitter();
}

root.eventEmmiter.addListener('screenRefresh', data => {
  const screenshootsDir = path.join(__dirname, '..', '..', 'screenshoots');
  const fileName = `${_.uuid()}.png`;
  const fileDir = path.join(screenshootsDir, fileName);
  _.mkdir(screenshootsDir);
  fs.writeFileSync(fileDir, data.value, 'base64');

  let action = null;
  let i = 0;
  for (; i < data.currentNode.actions.length; i++) {
    if (data.currentNode.actions[i].isTriggered === false) {
      action = data.currentNode.actions[i];
      break;
    }
  }

  mockData.current.image = `./${fileName}` ;
  mockData.current.list = [];
  mockData.current.list.push({'title': 'digest', 'value': data.currentNode.digest});
  mockData.current.list.push({'title': 'actions-done', 'value': i});
  mockData.current.list.push({'title': 'actions-total', 'value': data.currentNode.actions.length});
  mockData.current.list.push({'title': 'action-path', 'value': action ? action.location : 'all action cleared'});
  mockData.current.list.push({'title': 'depth', 'value': data.currentNode.depth});
  mockData.current.list.push({'title': 'node-type', 'value': data.currentNode.type});
  mockData.current.list.push({'title': 'action-description', 'value': action ? JSON.stringify(action.source) : ''});
});

root.eventEmmiter.addListener('terminateCrawling', data => {
  socketed.disconnected();
  process.exist();
});
