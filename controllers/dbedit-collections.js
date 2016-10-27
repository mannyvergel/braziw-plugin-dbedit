var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var models = web.cms.dbedit.conf.models;

		var modelInfos = [];
		for (var i in models) {
			var modelStr = models[i];
			modelInfos.push({name:getModelNameFromPath(modelStr), path: modelStr});
		}

		res.render(web.cms.dbedit.conf.collectionsView, {modelInfos: modelInfos, pageTitle: 'Collections'});
	}
}

function getModelNameFromPath(modelPath) {
	if (!modelPath) {
		return '';
	}

	var arrModelSplit = modelPath.split('/');
	var nameWithJs = arrModelSplit[arrModelSplit.length-1];
	return nameWithJs.split('.')[0];
}