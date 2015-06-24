var spawn = require('child_process').spawn,
  path = require('path'),
  SessionStub = require('./SessionStub'),
  DebuggerClient = require('../../lib/DebuggerClient').DebuggerClient,
  stopDebuggerCallbacks = [];

function startDebugger(scriptPath, breakOnStart, done) {
  if (done === undefined) {
    done = breakOnStart;
    breakOnStart = false;
  }

  var testDir = path.dirname(__filename),
    debugPort = 61000,
    debugOption,
    child,
    debuggerClient,
    session;

  debugOption = '--debug' + (breakOnStart ? '-brk=' : '=');
  if (scriptPath.indexOf(path.sep) == -1)
    scriptPath = path.join(testDir, '..', 'fixtures', scriptPath);
  child = spawn('node', [debugOption + debugPort, scriptPath]);

  var startupTimer = setTimeout(function() {
    throw new Error('Timeout while waiting for the child process to initialize the debugger.');
  }, 1000);

  child.stderr.on('data', function(data) {
    // Wait for the child process to initialize the debugger before connecting
    // Node v0.10 prints "debugger listening..."
    // Node v0.11 prints "Debugger listening..."
    if (/^[Dd]ebugger listening on port \d+$/m.test(data.toString())) {
      clearTimeout(startupTimer);
      // give the child process some time to finish the initialization code
      // this is especially important when breakOnStart is true
      setTimeout(setupDebuggerClient, 200);
    } else {
      // Forward any error messages from the child process
      // to our stderr to make troubleshooting easier
      process.stderr.write(data);
    }
  });

  stopDebuggerCallbacks.push(function stopDebugger() {
    debuggerClient.close();
    session = null;
    child.kill();
  });

  function setupDebuggerClient() {
    session = new SessionStub();
    debuggerClient = new DebuggerClient(debugPort);
    session.debuggerClient = debuggerClient;

    debuggerClient.connect();
    debuggerClient.on('connect', function() {
      injectTestHelpers(debuggerClient);
      done(child, session);
    });
    debuggerClient.on('error', function(e) {
      throw new Error('Debugger connection error: ' + e);
    });
  }
}

function runOnBreakInFunction(test) {
  stopAllDebuggers();
  startDebugger('BreakInFunction.js', function(childProcess, session) {
    session.debuggerClient.once('break', function() {
      test(session);
    });
    childProcess.stdin.write('go!\n');
  });
}

/** @param {function(DebuggerClient, string)} test */
function runInspectObject(test) {
  stopAllDebuggers();
  startDebugger('InspectObject.js', function(childProcess, session) {
    session.debuggerClient.once('break', function() {
      session.debuggerClient.fetchObjectId(
        session.debuggerClient,
        'inspectedObject',
        function(id) {
          test(session, id);
        }
      );
    });

    childProcess.stdin.write('go!\n');
  });
}

function runPeriodicConsoleLog(breakOnStart, test) {
  stopAllDebuggers();
  startDebugger(
    'PeriodicConsoleLog.js',
    breakOnStart,
    function(childProcess, session) {
      test(childProcess, session);
    }
  );
}

function runCommandlet(breakOnStart, test) {
  stopAllDebuggers();
  startDebugger(
    'Commandlet.js',
    breakOnStart,
    function(childProcess, session) {
      test(childProcess, session);
    }
  );
}

function stopAllDebuggers() {
  while (stopDebuggerCallbacks.length > 0)
    stopDebuggerCallbacks.shift()();
}

function stopAllDebugersAfterEachTest() {
  afterEach(stopAllDebuggers);
}

process.on('exit', function() {
  stopAllDebuggers();
});

function injectTestHelpers(debuggerClient) {
  debuggerClient.fetchObjectId =
    function(debuggerClient, expression, callback) {
      this.request(
        'evaluate',
        {
          expression: expression
        },
        function(err, response) {
          if (err) throw err;
          callback(String(response.handle));
        }
      );
    };
}

exports.startDebugger = startDebugger;
exports.runOnBreakInFunction = runOnBreakInFunction;
exports.runPeriodicConsoleLog = runPeriodicConsoleLog;
exports.runCommandlet = runCommandlet;
exports.stopAllDebuggers = stopAllDebuggers;
exports.stopAllDebuggersAfterEachTest = stopAllDebugersAfterEachTest;
exports.runInspectObject = runInspectObject;
