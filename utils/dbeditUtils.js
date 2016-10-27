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