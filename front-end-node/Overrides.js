/*jshint browser:true */
/*global WebInspector:true, InspectorFrontendHost:true, InspectorBackend:true, importScript:true */
/*global Preferences:true */

// Wire up websocket to talk to backend
// Disable HTML & CSS inspections
WebInspector.queryParamsObject['isSharedWorker'] = true;

Preferences.localizeUI = false;

WebInspector._platformFlavor = WebInspector.PlatformFlavor.MacLeopard;

// Do not offer download of the edited file when saving changes to V8.
// DevTools' implementation changes window.location which closes
// web-socket connection to the server and thus breaks the inspector.
InspectorFrontendHost.close = function(url, content, forceSaveAs) {
  delete this._fileBuffers[url];
};

// Let DevTools know we can save the content of modified files,
// so that a warning icon is not displayed in the file tab header.
// See UISourceCode.hasUnsavedCommittedChanges to understand why.
WebInspector.extensionServer._onSubscribe(
  {
    type:WebInspector.extensionAPI.Events.ResourceContentCommitted
  },
  {
    postMessage: function(msg) {
      // no-op
    }
  }
);

var oldDetached = WebInspector.detached;
WebInspector.detached = function () {
  oldDetached.apply(this, arguments);
  setTimeout(function () {
    location.reload();
  }, 400);
};
