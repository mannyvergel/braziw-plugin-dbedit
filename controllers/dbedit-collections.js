var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var modelInfos = web.cms.dbedit.conf.models;

		res.render(web.cms.dbedit.conf.collectionsView, {modelInfos: modelInfos, pageTitle: 'Collections'});
	}
}