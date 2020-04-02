'use strict';

const moment = web.require('moment-timezone');
const mongoose = web.require('mongoose');
const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

module.exports = function({
  modelName,
  displayName,
  cols,
  colMap = {},

  parentTemplate,
  shouldShowDeleteAction
} = {}) {

  return {
    get: async function(req, res) {
      let modelStr = modelName || req.query.model;
      let recId = req.query._id;

      let querySaveView = req.query.saveView;
      let queryDisplayName = displayName || req.query.displayName;

      let filterCols = cols || (req.query.filterCols && req.query.filterCols.split(','));
      const readOnly = (req.query.readOnly && req.query.readOnly.split(','));

      const readOnlyMap = readOnly && readOnly.reduce(function(map, obj) {
          map[obj] = obj;
          return map;
      }, {});

      shouldShowDeleteAction = shouldShowDeleteAction || req.query.shouldShowDeleteAction || 'Y';

      let model = web.cms.dbedit.utils.searchModel(modelStr);
      // deep clone
      let modelAttr = model.getModelDictionary();
      let modelSchema = modelAttr.schema;

      let myModelName = modelAttr.name;
      let modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;

      parentTemplate = parentTemplate || web.cms.conf.adminTemplate;

      if (!filterCols) {
        filterCols = Object.keys(modelSchema);
      }
      //can be optimized by avoiding query if there's no id
      let rec = {};
      if (recId) {
        rec = await model.findOne({_id:recId}).exec()
      }
      
      for (let i in modelSchema) {
        let colName = i;
        let attr = modelSchema[colName];

        if (attr.default && rec[colName] === undefined) {
          // assign default values if non existing
          rec[colName] = attr.default;
        }

        attr.dbeditDisplay = (colMap[colName] && colMap[colName].label) || attr.dbeditDisplay || web.cms.dbedit.utils.camelToTitle(i);
      }

      let redirectAfter = req.query._backUrl || ('/admin/dbedit/list?model=' + (req.query.model || ''));


      let pageTitle = null;
      
      if (!rec._id) {
        pageTitle = 'Create ' + modelDisplayName;
      } else {
        pageTitle = 'Update ' + modelDisplayName;
      }

      for (let i in colMap) {
        if (colMap[i].inputValues && web.objectUtils.isFunction(colMap[i].inputValues)) {
          colMap[i].inputValues = await colMap[i].inputValues(rec);
        }
      }

      let saveView = querySaveView || web.cms.dbedit.conf.saveView;
      res.render(saveView, {
        rec: rec, 
        modelAttr: modelAttr,
        queryModelName: req.query.model,
        pageTitle: pageTitle, 
        redirectAfter: redirectAfter,
        readOnlyMap: readOnlyMap,
        colMap: colMap,
        parentTemplate: parentTemplate,
        filterCols: filterCols,
        shouldShowDeleteAction: shouldShowDeleteAction,
      });

    },

    post: async function(req, res) {

      // TODO: proper error handling

      let myModelName = modelName || req.body.modelName;
      let recId = req.body._id;
      if (recId == "") {
        recId = null;
      }

      let model = web.models(myModelName);
      let modelAttr = model.getModelDictionary();

      let redirectAfter = req.body._backUrl || '/admin/dbedit/list?model=' + (req.body.modelName || '');

      //can be optimized by avoiding query if there's no id
      let rec = await model.findOne({_id:recId});

      let attrToSet = Object.assign({}, req.body);

      const shouldSetProperTimezone = web.cms.dbedit.conf.timezone;


      for (let colName in modelAttr.schema) {
        let dbCol = modelAttr.schema[colName];


        if (shouldSetProperTimezone && dbCol.type == Date) {

          if (attrToSet[colName]) {
            let dateFormat = 'MM/DD/YYYY'; 

            if (colMap[colName] && colMap[colName].inputType === "datetime") {
              dateFormat = 'MM/DD/YYYY hh:mm A';
            }
            attrToSet[colName] = moment.tz(attrToSet[colName], dateFormat, web.cms.dbedit.conf.timezone).toDate();
          } else if (attrToSet[colName] === "") {
            attrToSet[colName] = null;
          }
        } else if (dbCol.type == ObjectId) {
          if (!attrToSet[colName]) {
            // for errors of casting empty string to object id
            attrToSet[colName] = null;
          }
        }
      }


      if (!rec) {
        rec = new model();
        attrToSet.createDt = new Date();
        attrToSet.createBy = req.user._id;
      }

      delete attrToSet._id;
      attrToSet[web.cms.dbedit.conf.updateDtCol] = new Date();
      attrToSet[web.cms.dbedit.conf.updateByCol] = req.user._id;

      

      rec.set(attrToSet);


      if (web.conf.saveDb) {
        await web.conf.saveDb(rec, req);
      } else {
        await rec.save();
      }

      req.flash('info', 'Record saved.');
      res.redirect(redirectAfter);

    }
  }


}
