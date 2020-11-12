'use strict';

const pluginConf = web.plugins['braziw-plugin-dbedit'].conf;

module.exports = {
	'/admin/dbedit/save': require('../controllers/dbedit-save.js'),
	'/admin/dbedit/collections': require('../controllers/dbedit-collections.js'),
	'/admin/dbedit/list': require('../controllers/dbedit-list.js'),
	'/admin/dbedit/delete': require('../controllers/dbedit-delete.js'),

  '/dbe/public/js/setup-datepicker.js': function(req, res, next) {web.utils.serveStaticFile(pluginConf.pluginPath + '/public/js/setup-datepicker.js', res)},
  '/dbe/public/js/unsaved-changes-prompt-all.js': function(req, res, next) {web.utils.serveStaticFile(pluginConf.pluginPath + '/public/js/unsaved-changes-prompt-all.js', res)},
  '/dbe/public/js/unsaved-changes-prompt.js': function(req, res, next) {web.utils.serveStaticFile(pluginConf.pluginPath + '/public/js/unsaved-changes-prompt.js', res)},
}