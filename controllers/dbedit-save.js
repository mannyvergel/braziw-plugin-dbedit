'use strict';


module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		var recId = req.query._id;

		var querySaveView = req.query.saveView;
		var queryDisplayName = req.query.displayName;

		const filterCols = (req.query.filterCols && req.query.filterCols.split(','));
		const readOnly = (req.query.readOnly && req.query.readOnly.split(','));

		const readOnlyMap = readOnly && readOnly.reduce(function(map, obj) {
		    map[obj] = obj;
		    return map;
		}, {});

		var model = web.cms.dbedit.utils.searchModel(modelStr);
		// deep clone
		var modelAttr = JSON.parse(JSON.stringify(model.getModelDictionary()));
		var modelSchema = modelAttr.schema;

		var modelName = modelAttr.name;
		var modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;

		if (filterCols) {
			for (let [key, val] of Object.entries(modelSchema)) {
				if (filterCols.indexOf(key) == -1) {
					delete modelSchema[key];
				}
			}
		}
		
		for (var i in modelSchema) {
			var colName = i;
			var attr = modelSchema[colName];

			// if (filterCols && filterCols.indexOf(colName) == -1) {
			// 	delete modelSchema[colName];
			// }
			attr.dbeditDisplay = web.cms.dbedit.utils.camelToTitle(i);
		}

		var redirectAfter = req.query.redirectAfter || ('/admin/dbedit/list?model=' + modelName);

		//can be optimized by avoiding query if there's no id
		model.findOne({_id:recId}, function(err, rec) {
			var pageTitle = null;
			if (!rec) {
				pageTitle = 'Create ' + modelDisplayName;
			} else {
				pageTitle = 'Update ' + modelDisplayName;
			}

			var saveView = querySaveView || web.cms.dbedit.conf.saveView;
			res.render(saveView, {
				rec: rec || {}, 
				modelAttr: modelAttr, 
				pageTitle: pageTitle, 
				redirectAfter: redirectAfter,
				readOnlyMap: readOnlyMap,
			});
		});
	},

	post: function(req, res) {
		//TODO: CSRF to avoid cross site x

		var modelName = req.body.modelName;
		var recId = req.body._id;
		if (recId == "") {
			recId = null;
		}

		var model = web.models(modelName);
		var modelAttr = model.getModelDictionary();
		var modelDisplayName = modelAttr.displayName || modelAttr.name;

		var redirectAfter = req.body.redirectAfter || '/admin/dbedit/list?model=' + modelName;

		//can be optimized by avoiding query if there's no id
		model.findOne({_id:recId}, function(err, rec) {
			if (err) {
				throw err;
			}

			var attrToSet = Object.assign({}, req.body);
			if (!rec) {
				rec = new model();
				attrToSet.createDt = new Date();
				attrToSet.createBy = req.user._id;
			}
			
			delete attrToSet._id;
			attrToSet[web.cms.dbedit.conf.updateDtCol] = new Date();
			attrToSet[web.cms.dbedit.conf.updateByCol] = req.user._id;

			rec.set(attrToSet);


			rec.save(function(err) {
				if (err) {
					throw err;
				}

				req.flash('info', 'Record saved.');
				res.redirect(redirectAfter);
			})
		})
	}
}