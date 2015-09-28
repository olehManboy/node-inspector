var expect = require('chai').expect,
    launcher = require('./helpers/launcher.js'),
    EventEmitter = require('events').EventEmitter,
    InjectorClient = require('../lib/InjectorClient').InjectorClient,
    HeapProfilerAgent = require('../lib/HeapProfilerAgent').HeapProfilerAgent,
    HeapProfilerClient = require('../lib/HeapProfilerClient').HeapProfilerClient;

var heapProfilerAgent,
    heapProfilerClient,
    debuggerClient,
    frontendClient;

describe('HeapProfiler Agent', function() {
  before(initializeProfiler);

  it('should take snapshot with report progress', function(done) {
    var progress,
        total,
        state = 0,
        data = '';

    function updateState() {
      if (++state == 2) {
        frontendClient.off('HeapProfiler.reportHeapSnapshotProgress', onReportHeapSnapshotProgress);
        frontendClient.off('HeapProfiler.addHeapSnapshotChunk', onAddHeapSnapshotChunk);
        done();
      }
    }

    function onReportHeapSnapshotProgress(message) {
      expect(message).to.have.keys(['done', 'total', 'finished']);
      if (message.finished) updateState();
    }

    function onAddHeapSnapshotChunk(message) {
      expect(message).to.have.keys(['chunk']);
      data += message.chunk;
    }

    frontendClient.on('HeapProfiler.reportHeapSnapshotProgress', onReportHeapSnapshotProgress);
    frontendClient.on('HeapProfiler.addHeapSnapshotChunk', onAddHeapSnapshotChunk);

    heapProfilerAgent.takeHeapSnapshot(
      {
        reportProgress: true
      },
      function(error, result){
        expect(error).to.equal(null);
        expect(result).to.equal(undefined);
        updateState();
      }
    );
  });

  it('should start tracking', function(done) {
    var state = {
      heapStatsUpdate: false,
      lastSeenObjectId: false
    };
    function updateState(name) {
      expect(state[name]).to.equal(false);
      state[name] = true;
      if (state.heapStatsUpdate && state.lastSeenObjectId) done();
    }

    frontendClient.once('HeapProfiler.heapStatsUpdate', function(message) {
      expect(message).to.have.keys(['statsUpdate']);
      updateState('heapStatsUpdate');
    });

    frontendClient.once('HeapProfiler.lastSeenObjectId', function(message) {
      expect(message).to.have.keys(['lastSeenObjectId', 'timestamp']);
      updateState('lastSeenObjectId');
    });

    heapProfilerAgent.startTrackingHeapObjects({}, function(error, result) {
      expect(error).to.equal(null);
      expect(result).to.equal(undefined);
    });
  });

  it('should stop tracking', function(done) {
    heapProfilerAgent.startTrackingHeapObjects({}, function(error, result) {
      expect(error).to.be.equal(null);
      expect(result).to.be.equal(undefined);
      done();
    });
  });
});



describe('HeapProfilerClient', function() {
  it('should match only valid heapObjectId', function() {
    function expectIsHeapObjectId(id, value) {
      expect(heapProfilerClient.isHeapObjectId(id), id).to.be.equal(value);
    }

    expectIsHeapObjectId('heap:1', true);
    expectIsHeapObjectId('heap:1:1', false);
    expectIsHeapObjectId('heap:a', false);
    expectIsHeapObjectId('heap:', false);
    expectIsHeapObjectId('hea:1', false);
    expectIsHeapObjectId(':', false);
    expectIsHeapObjectId('1', false);
  });
});

function initializeProfiler(done) {
  launcher.runCommandlet(true, function(childProcess, session) {
    debuggerClient = session.debuggerClient;
    frontendClient = session.frontendClient;

    var injectorClient = new InjectorClient({}, session);
    session.injectorClient = injectorClient;

    heapProfilerClient = new HeapProfilerClient({}, session);
    session.heapProfilerClient = heapProfilerClient;

    heapProfilerAgent = new HeapProfilerAgent({}, session);

    injectorClient.inject(function(error) {
      if (error) return done(error);
      debuggerClient.request('continue', null, function() {
        childProcess.stdin.write('log loop\n');
        done();
      });
    });
  });
}
