'use strict';

module.exports = {
	get: async function(req, res) {
		//customizable through get parameters:

		const querySort = req.query.sort && JSON.parse(req.query.sort);
		const queryCols = req.query.cols && JSON.parse(req.query.cols); //db columns to add
		
		const queryLabels = req.query.labels && JSON.parse(req.query.labels); //if cols is specified, and this is not, just convert to title case
		
		const queryListView = req.query.listView;
		const queryPageTitle = req.query.pageTitle;
		const queryDisplayName = req.query.displayName;
		const querySaveParams = req.query.saveParams || "";


		// this replaces the db query
		const queryQuery = req.query.query && JSON.parse(req.query.query);

		// this extends the db query
		const queryFilter = req.query.filter && JSON.parse(req.query.filter);


		const modelStr = req.query.model;
		//should be in cache by this time (assumption)
		const model = web.cms.dbedit.utils.searchModel(modelStr);
		const modelAttr = model.getModelDictionary();
		const modelSchema = modelAttr.schema;
		const modelName = modelAttr.name;
		const modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;
		const modelConf = web.cms.dbedit.utils.getModelConf(modelName) || {};
		const sortDefault = {};
		sortDefault[web.cms.dbedit.conf.updateDtCol] = -1;

		modelConf.sort = querySort || modelConf.sort || sortDefault;

		let cols = queryCols || modelConf.cols;
		if (!cols) {
			cols = [];
			const maxColsDisplay = 4;
			let counter = 0;
			for (let i in modelSchema) {

				cols.push(i);

				counter++;
				if (counter > maxColsDisplay) {
					break;
				}
			}
		}

		let labels = queryLabels || modelConf.labels;
		if (!labels) {
			labels = [];
			for (let i=0; i<cols.length; i++) {
				labels.push(web.cms.dbedit.utils.camelToTitle(cols[i]));
			}
		}

		//put Action column first
		cols.unshift('_id');
		labels.unshift('Actions');

		const redirectAfter = encodeURIComponent(req.url);
		let handlers = modelConf.handlers;
		if (!handlers) {
			
			handlers = {
			  	_id: function(record, column, escapedVal, callback) {
					callback(null, ['<a href="/admin/dbedit/save?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=' + redirectAfter + '&'  + querySaveParams + '"><i class="fa fa-pencil fa-fw dbedit" style=""></i></a>', 
						'<a onclick="return confirm(\'Do you want to delete this record?\')" href="/admin/dbedit/delete?model=' + modelName + '&_id=' + escapedVal + '&redirectAfter=' + redirectAfter + '"><i class="fa fa-remove fa-fw dbedit" style="color: red;"></i></a>']
						.join(' '));
				}
			  };
		}
		

		let query = queryQuery || modelConf.query || {}; //else query everything

		if (queryFilter) {
			query = Object.assign(query, queryFilter);
		}

		const table = await web.renderTable(req, model, {
			  query: query,
			  columns: cols,
			  labels: labels,
			  sort: modelConf.sort,
			  handlers: handlers
			});

		const listView = queryListView || modelConf.view || web.cms.dbedit.conf.listView;
		const pageTitle = queryPageTitle || modelConf.pageTitle || (modelDisplayName + ' List');
		res.render(listView, {
			table: table,
			redirectAfter: redirectAfter,
			saveParams: querySaveParams,
			pageTitle: pageTitle,
			modelName: modelName,
			modelDisplayName: modelDisplayName,
			filter: JSON.stringify(queryFilter),
			sort: JSON.stringify(querySort)
		});
	}
}