$.fn.unsavedChangesPrompt = function(opts) {
    var self = this;

    var serializer = (opts && opts.serializer) || function(frm) {
      return $(frm).serialize()
    };
    $(self).each(function(index, frm) {
      var frmObj = $(frm);
      frmObj.data('submitting', 'N');
      frmObj.submit(function(){
        frmObj.data('submitting', 'Y');
      });

      frmObj.data('initial-state', serializer(frm));
    })

    $(window).bind("beforeunload", function(e) {
      var msg = null;
      $(self).each(function(index, frm) {
        var frmObj = $(frm);
        
        if (frmObj.data('submitting') != 'Y') {
          if (serializer(frm) != frmObj.data('initial-state')) {
            msg = 'You have unsaved changes which will not be saved.'
          }
        }

      });
      
      if (msg) {
        return e.originalEvent.returnValue = msg;
      }

    });
};
