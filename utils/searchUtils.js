'use strict';

exports.wrapSearch = function(searchVal) {
  return new RegExp('.*' + web.stringUtils.escapeRegexp(searchVal) + '.*', 'i');
}
