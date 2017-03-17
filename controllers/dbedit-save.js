var dbeditUtils = require('../utils/dbeditUtils.js');
module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		var recId = req.query._id;

		var model = dbeditUtils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;
		var modelDisplayName = modelAttr.displayName || modelAttr.name;

		for (var i in modelSchema) {
			var attr = modelSchema[i];
			attr.dbeditDisplay = dbeditUtils.camelToTitle(i);
		}

		var redirectAfter = '/admin/dbedit/list?model=' + modelName;

		//can be optimized by avoiding query if there's no id
		model.findOne({_id:recId}, function(err, rec) {
			var pageTitle = null;
			if (!rec) {
				pageTitle = 'Create ' + modelDisplayName;
			} else {
				pageTitle = 'Update ' + modelDisplayName;
			}
			res.render(web.cms.dbedit.conf.saveView, {rec: rec || {}, modelAttr: modelAttr, pageTitle: pageTitle, redirectAfter: redirectAfter});
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
			attrToSet.lastModDt = new Date();
			attrToSet.lastModBy = req.user._id;

			rec.set(attrToSet);


			rec.save(function(err) {
				if (err) {
					throw err;
				}

				req.flash('info', modelName + ' saved.');
				res.redirect(redirectAfter);
			})
		})
	}
}