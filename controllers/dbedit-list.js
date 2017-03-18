
module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		//should be in cache by this time (assumption)
		var model = web.cms.dbedit.utils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;
		var modelDisplayName = modelAttr.displayName || modelAttr.name;
		var modelConf = web.cms.dbedit.utils.getModelConf(modelName);
		var sortDefault = {};
		sortDefault[web.cms.dbedit.conf.updateDtCol] = -1;
		modelConf.sort = modelConf.sort || sortDefault;

		var cols = modelConf.cols;
		var labels = modelConf.labels;
		if (!cols) {
			cols = ['_id'];
			labels = ['Actions'];
			var maxColsDisplay = 4;
			var counter = 0;
			for (var i in modelSchema) {

				cols.push(i);
				labels.push(web.cms.dbedit.utils.camelToTitle(i));

				counter++;
				if (counter > maxColsDisplay) {
					break;
				}
			}
		}
		var handlers = modelConf.handlers;
		if (!handlers) {
			handlers = {
			  	_id: function(record, column, escapedVal, callback) {
					callback(null, ['<a href="/admin/dbedit/save?model=' + modelName + '&_id=' + escapedVal + '"><i class="fa fa-pencil fa-fw dbedit" style=""></i></a>', 
						'<a onclick="return confirm(\'Do you want to delete this record?\')" href="/admin/dbedit/delete?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=/admin/dbedit/list?model=' + modelName + '"><i class="fa fa-remove fa-fw dbedit" style="color: red;"></i></a>']
						.join(' '));
				}
			  };
		}
		

		var query = modelConf.query || {}; //else query everything
		web.renderTable(req, model, {
			  query: query,
			  columns: cols,
			  labels: labels,
			  sort: modelConf.sort,
			  handlers: handlers
			}, 
			function(err, table) {
				var listView = modelConf.view || web.cms.dbedit.conf.listView;
				var pageTitle = modelConf.pageTitle || (modelDisplayName + ' List');
				res.render(listView, {table: table, pageTitle: pageTitle, modelName: modelName, modelDisplayName: modelDisplayName});
		});
	}
}