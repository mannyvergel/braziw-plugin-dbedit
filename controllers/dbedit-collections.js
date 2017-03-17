var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var modelInfos = web.cms.dbedit.conf.models;

    for (var i in modelInfos) {
      var modelInfo = modelInfos[i];
      var model = dbeditUtils.searchModel(modelInfo.name);
      var modelAttr = model.getModelDictionary();
      modelInfo.displayName = modelAttr.displayName || modelAttr.name;
    }

		res.render(web.cms.dbedit.conf.collectionsView, {modelInfos: modelInfos, pageTitle: 'Collections'});
	}
}