var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		//should be in cache by this time (assumption)
		var model = dbeditUtils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;

		var cols = ['_id'];
		var labels = ['Actions'];
		var maxColsDisplay = 4;
		var counter = 0;
		for (var i in modelSchema) {
			if (i == 'password') {
				//special cases
				continue;
			}

			cols.push(i);
			labels.push(dbeditUtils.camelToTitle(i));

			counter++;
			if (counter > maxColsDisplay) {
				break;
			}
		}

		var query = {}; //query everything
		web.renderTable(req, model, {
			  query: query,
			  columns: cols,
			  labels: labels,
			  handlers: {
			  	_id: function(record, column, escapedVal, callback) {
					callback(null, ['<a href="/admin/dbedit/save?model=' + modelName + '&_id=' + escapedVal + '"><i class="fa fa-pencil fa-fw dbedit" style=""></i></a>', 
						'<a onclick="return confirm(\'Do you want to delete this record?\')" href="/admin/dbedit/delete?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=/admin/dbedit/list?model=' + modelName + '"><i class="fa fa-remove fa-fw dbedit" style="color: red;"></i></a>']
						.join(' '));
				}
			  }
			}, 
			function(err, table) {
			res.render(web.cms.dbedit.conf.listView, {table: table, pageTitle: modelName + ' List', modelName: modelName});
		});
	}
}