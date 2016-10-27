exports.camelToTitle = function(text) {
	if (!text) {
		return '';
	}

	var result = text.replace( /([A-Z])/g, " $1" );
	return result.charAt(0).toUpperCase() + result.slice(1); 
}

exports.searchModel = function(modelStr) {
	
	if (modelStr.indexOf('/') != -1) {
		return web.includeModel(modelStr);
	} else {
		return web.models(modelStr);
	}
}

exports.getModelConf = function(modelName) {
	var modelConfs = web.cms.dbedit.conf.models;
	for (var i in modelConfs) {
		var modelConf = modelConfs[i];
		if (modelConf.name == modelName || modelConf.path == modelName) {
			return modelConf
		}
	}

	return null;
}