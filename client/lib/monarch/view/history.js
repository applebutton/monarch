constructor("View.History", {
  on_change: function(callback) {
    jQuery.historyInit(callback);
  },

  load: function(path) {
    jQuery.historyLoad(path);
  }
});