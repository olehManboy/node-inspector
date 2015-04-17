/*jshint browser:true, nonew:false*/
/*global WebInspector, Runtime*/
WebInspector.NodeInspectorOverrides = function() {
  this._overridenStrings = {};
  this._overrideMainScriptType();
  this._overrideUIStrings();

  this._openMainScriptOnStartup();
};

WebInspector.NodeInspectorOverrides.prototype = {
  _overrideMainScriptType: function() {
    WebInspector.ResourceTreeModel.prototype.orig_createResourceFromFramePayload =
      WebInspector.ResourceTreeModel.prototype._createResourceFromFramePayload;

    WebInspector.ResourceTreeModel.prototype._createResourceFromFramePayload =
      function(frame, url, type, mimeType) {
        // Force Script type for all node frames.
        // Front-end assigns Document type (i.e. HTML) to our main script file.
        if (frame._isNodeInspectorScript) {
          type = WebInspector.resourceTypes.Script;
        }

        return this.orig_createResourceFromFramePayload(frame, url, type, mimeType);
      };
  },
  _overrideUIStrings: function() {
    var overridenStrings = this._overridenStrings;
    WebInspector.orig_UIString = WebInspector.UIString;
    WebInspector.UIString = function(string, vararg) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = overridenStrings[string] || string;
      return this.orig_UIString.apply(this, args);
    };
  },
  _openMainScriptOnStartup: function() {
    WebInspector.targetManager.addModelListener(
      WebInspector.ResourceTreeModel,
      WebInspector.ResourceTreeModel.EventTypes.CachedResourcesLoaded,
      showMainAppFile,
      null
    );
  }
};

new WebInspector.NodeInspectorOverrides();


function showMainAppFile() {
  WebInspector.inspectorView.showPanel('sources').then(function(panel) {
    var fileTabs = panel._sourcesView._editorContainer._files;

    if (Object.keys(fileTabs).length > 0){
      // Some files are already opened - do not change user's workspace
      return;
    }

    var uiSourceCodes = getAllUiSourceCodes();
    var uriToShow = WebInspector.inspectedPageURL;

    for (var i in uiSourceCodes) {
      if (uiSourceCodes[i].url !== uriToShow) continue;
      panel.showUISourceCode(uiSourceCodes[i]);
      return true;
    }

    console.error('Cannot show the main application file ', uriToShow);
  });
}

function getAllUiSourceCodes() {
  // Based on FilteredItemSectionDialog.js > SelectUISourceCodeDialog()
  var projects = WebInspector.workspace.projects();
  var uiSourceCodes = [];
  var projectFiles;

  for (var i = 0; i < projects.length; ++i) {
    projectFiles = projects[i]
      .uiSourceCodes()
      .filter(nameIsNotEmpty);
    uiSourceCodes = uiSourceCodes.concat(projectFiles);
  }

  return uiSourceCodes;

  function nameIsNotEmpty(p) {
    return p.name();
  }
}
