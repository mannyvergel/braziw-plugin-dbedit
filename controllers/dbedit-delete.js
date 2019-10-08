'use strict';

module.exports = {
	get: function(req, res) {
		var modelStr = req.query.model;
		var recId = req.query._id;

		var model = web.cms.dbedit.utils.searchModel(modelStr);
		var modelAttr = model.getModelDictionary();
		var modelSchema = modelAttr.schema;
		var modelName = modelAttr.name;

		var redirectAfter = req.query.redirectAfter;

		//can be optimized by avoiding query if there's no id
		model.findOne({_id:recId}, function(err, rec) {
			if (!rec) {
				throw new Error("Record not found.");
			}


			rec.remove(function(err) {
				if (err) {
					throw err;
				}
				req.flash('info', "Record has been deleted.");
				res.redirect(redirectAfter);
			})
		});
	}
}