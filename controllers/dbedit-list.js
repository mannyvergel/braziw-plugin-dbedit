
module.exports = {
	get: function(req, res) {
		//customizable through get parameters:
		var querySort = req.query.sort;
		if (querySort) {
			querySort = JSON.parse(querySort);
		}
		var queryCols = req.query.cols; //db columns to add
		if (queryCols) {
			queryCols = JSON.parse(queryCols);
		}
		var queryLabels = req.query.labels; //if cols is specified, and this is not, just convert to title case
		if (queryLabels) {
			queryLabels = JSON.parse(queryLabels);
		}
		var queryListView = req.query.listView;
		var queryPageTitle = req.query.pageTitle;
		var queryDisplayName = req.query.displayName;
		var querySaveParams = req.query.saveParams || "";


		var modelStr = req.query.model;
		//should be in cache by this time (assumption)
		var model = web.cms.dbedit.utils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;
		var modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;
		var modelConf = web.cms.dbedit.utils.getModelConf(modelName) || {};
		var sortDefault = {};
		sortDefault[web.cms.dbedit.conf.updateDtCol] = -1;

		modelConf.sort = querySort || modelConf.sort || sortDefault;

		var cols = queryCols || modelConf.cols;
		if (!cols) {
			cols = [];
			var maxColsDisplay = 4;
			var counter = 0;
			for (var i in modelSchema) {

				cols.push(i);

				counter++;
				if (counter > maxColsDisplay) {
					break;
				}
			}
		}

		var labels = queryLabels || modelConf.labels;
		if (!labels) {
			labels = [];
			for (var i=0; i<cols.length; i++) {
				labels.push(web.cms.dbedit.utils.camelToTitle(cols[i]));
			}
		}

		//put Action column first
		cols.unshift('_id');
		labels.unshift('Actions');

		var redirectAfter = encodeURIComponent(req.url);
		var handlers = modelConf.handlers;
		if (!handlers) {
			
			handlers = {
			  	_id: function(record, column, escapedVal, callback) {
					callback(null, ['<a href="/admin/dbedit/save?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=' + redirectAfter + '&'  + querySaveParams + '"><i class="fa fa-pencil fa-fw dbedit" style=""></i></a>', 
						'<a onclick="return confirm(\'Do you want to delete this record?\')" href="/admin/dbedit/delete?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=' + redirectAfter + '"><i class="fa fa-remove fa-fw dbedit" style="color: red;"></i></a>']
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
				var listView = queryListView || modelConf.view || web.cms.dbedit.conf.listView;
				var pageTitle = queryPageTitle || modelConf.pageTitle || (modelDisplayName + ' List');
				res.render(listView, {table: table, redirectAfter: redirectAfter, saveParams: querySaveParams, pageTitle: pageTitle, modelName: modelName, modelDisplayName: modelDisplayName});
		});
	}
}