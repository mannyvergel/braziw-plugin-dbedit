var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		//should be in cache by this time (assumption)
		var model = dbeditUtils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;
		var modelConf = dbeditUtils.getModelConf(modelName);

		var cols = modelConf.cols;
		var labels = modelConf.labels;
		if (!cols) {
			cols = ['_id'];
			labels = ['Actions'];
			var maxColsDisplay = 4;
			var counter = 0;
			for (var i in modelSchema) {

				cols.push(i);
				labels.push(dbeditUtils.camelToTitle(i));

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
			  handlers: handlers
			}, 
			function(err, table) {
				var listView = modelConf.view || web.cms.dbedit.conf.listView;
				var pageTitle = modelConf.pageTitle || (modelName + ' List');
				res.render(listView, {table: table, pageTitle: pageTitle, modelName: modelName});
		});
	}
}