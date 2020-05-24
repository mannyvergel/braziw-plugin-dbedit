'use strict';

const moment = require('moment-timezone');
const mongoose = web.require('mongoose');
const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

module.exports = function({
  modelName,
  displayName,
  cols,
  colMap = {},
  enableDangerousClientFiltering = false,
  style,

  populate,

  // do you validations, extra save logic here
  // throw an error or handle it yourself by returning true
  beforeSave = (record, req, res)=>{}, 
  beforeRender,
  afterSave,

  parentTemplate,
  shouldShowDeleteAction = true,

  additionalSubmitButtons = [],

  handlers = {},

} = {}) {

  return {
    get: async function(req, res) {
      let queryModel = enableDangerousClientFiltering && req.query.model;
      let modelStr = modelName || queryModel;
      let recId = req.query._id;
      let isUpdateMode = recId;
      let isInsertMode = !isUpdateMode;

      let querySaveView = req.query.saveView;
      let queryDisplayName = displayName || req.query.displayName;

      let colIds = [];
      for (let col of cols || []) {
        if (web.objectUtils.isString(col)) {
          colIds.push(col);
        } else {
          colIds.push(col.id);
          colMap[col.id] = Object.assign({}, col, colMap[col.id]);
        }
      }

      let filterCols = (colIds.length > 0 ? colIds : null) 
        || (enableDangerousClientFiltering && req.query.filterCols && req.query.filterCols.split(','));

      const readOnly = (enableDangerousClientFiltering && req.query.readOnly && req.query.readOnly.split(','));

      shouldShowDeleteAction = shouldShowDeleteAction || (enableDangerousClientFiltering && req.query.shouldShowDeleteAction);

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
      
      let redirectAfter = req.query._backUrl 
        || ('/admin/dbedit/list' 
            + (queryModel ? ('?model=' + encodeURIComponent(queryModel)) : ''));

      //can be optimized by avoiding query if there's no id
      let rec = {};
      if (isUpdateMode) {
        let recProm = model.findOne({_id:recId});
        if (populate) {
          recProm.populate(populate);
        }
        rec = await recProm.exec();
        if (!rec) {
          req.flash('error', 'Record not found.');
          res.redirect(redirectAfter);
          return;
        }
      }
      

      let pageTitle = null;
      
      if (isUpdateMode) {
        pageTitle = 'Update ' + modelDisplayName;
      } else {
        pageTitle = 'Create ' + modelDisplayName;
      }

      for (let colName in colMap) {
        let colMapObj = colMap[colName];

        if (colMapObj.default && rec[colName] === undefined) {
          rec[colName] = colMapObj.default;
        }
        
        handleModelSchemaForColObj(modelSchema, colName, colMap, rec)


        if (handlers[colName]) {
          colMapObj.htmlValue = await handlers[colName](rec, isUpdateMode);
        }


        handleColObjMultiple(colMapObj, colName, rec);

        if (colMapObj.inputValues && web.objectUtils.isFunction(colMapObj.inputValues)) {
          // need to do this to avoid the cache and overwriting the existing
          colMapObj.inputValuesFunc = colMapObj.inputValues;
        }

        if (colMapObj.inputValuesFunc) {
          colMapObj.inputValues = await colMapObj.inputValuesFunc(rec, req);
        }

        colMapObj.readOnlyComputed = (readOnly && readOnly.indexOf(colName) !== -1)
          || (colMapObj.readOnly === 'U' && isUpdateMode)
          || (colMapObj.readOnly === 'I' && isInsertMode)
          || (web.objectUtils.isFunction(colMapObj.readOnly) && await colMapObj.readOnly(rec, req))
          || colMapObj.readOnly === true;

        colMapObj.visibleComputed = true;
        if (colMapObj.visible !== undefined) {
          colMapObj.visibleComputed = await colMapObj.visible(rec, req);
        }

        let propsStrArr = [];

        colMapObj.props = colMapObj.props || {};

        let inputType = colMapObj.inputType || colMapObj.props.type || 'text';

        if (inputType === 'money') {
          inputType = 'number';
          colMapObj.props.step = '0.01';
        }

        switch (inputType) {
          case 'datetime':
          case 'date':
          case 'radio':
          case 'checkbox': 
          case 'select': break;

          default: colMapObj.props.type = inputType;
        }

        for (let propName in colMapObj.props) {
          let propsValStr = colMapObj.props[propName] || '';
          propsStrArr.push(`${propName}="${web.stringUtils.escapeHTML(propsValStr)}"`)
        }


        // TODO: unify all props later
        colMapObj._propsHtml = propsStrArr.join(' ');

      }

      for (let submitBtnObj of additionalSubmitButtons) {
        submitBtnObj.visibleComputed = true;

        if (submitBtnObj.visible) {
          submitBtnObj.visibleComputed = await submitBtnObj.visible(rec, req, isInsertMode);
        }
      }

      let options = {
        rec: rec, 
        style: style,
        isUpdateMode: isUpdateMode,
        modelAttr: modelAttr,
        queryModelName: queryModel,
        pageTitle: pageTitle, 
        redirectAfter: redirectAfter,
        colMap: colMap,
        parentTemplate: parentTemplate,
        filterCols: filterCols,
        shouldShowDeleteAction: shouldShowDeleteAction,
        additionalSubmitButtons: additionalSubmitButtons,
      };

      if (beforeRender) {
        await beforeRender(req, res, options);
      }

      let saveView = (enableDangerousClientFiltering && querySaveView) || web.cms.dbedit.conf.saveView;
      res.render(saveView, options);

    },

    post: async function(req, res) {

      // TODO: proper error handling

      let queryModelName = enableDangerousClientFiltering && req.body.modelName;

      let myModelName = modelName || queryModelName || '';
      let recId = req.body._id;
      if (recId == "") {
        recId = null;
      }

      let isInsertMode = !recId;

      let model = web.models(myModelName);
    
      let rec = await save(recId, req, res, model, beforeSave, colMap, isInsertMode, queryModelName);

      if (!rec) {
        return;
      }

      if (afterSave && await afterSave(rec, req, res, isInsertMode)) {
        return;
      }

      let handled = false;
      for (let submitBtnObj of additionalSubmitButtons) {

        if (req.body.hasOwnProperty(submitBtnObj.actionName)) {
          handled = await submitBtnObj.handler(rec, req, res);
        }
      }

      if (!handled) {
        req.flash('info', 'Record saved.');
        res.redirect(getRedirectAfter(rec, req, queryModelName));
      }


    }
  }


}


async function save(recId, req, res, model, beforeSave, colMap, isInsertMode, queryModelName) {
  let rec = await model.findOne({_id:recId});

  let modelAttr = model.getModelDictionary();
  let modelSchema = modelAttr.schema;

  // TODO: use the col list to set one by one
  let attrToSet = Object.assign({}, req.body);

  const shouldSetProperTimezone = web.conf.timezone;


  for (let colName in modelAttr.schema) {
    if (attrToSet[colName] || attrToSet[colName] === "") {
      if (web.objectUtils.isArray(modelSchema[colName])) {
        attrToSet[colName] =  web.ext.arrayUtils.removeDuplicateAndEmpty(attrToSet[colName]);
      }

      let dbCol = modelAttr.schema[colName];


      if (shouldSetProperTimezone && dbCol.type == Date) {

        if (attrToSet[colName]) {
          let dateFormat = 'MM/DD/YYYY'; 

          if (colMap[colName] && colMap[colName].inputType === "datetime") {
            dateFormat = 'MM/DD/YYYY hh:mm A';
          }
          attrToSet[colName] = moment.tz(attrToSet[colName], dateFormat, web.conf.timezone).toDate();
        } else if (attrToSet[colName] === "") {
          attrToSet[colName] = null;
        }
      } else if (dbCol.type == ObjectId) {
        if (attrToSet[colName] === "") {
          // for errors of casting empty string to object id
          attrToSet[colName] = null;
        }
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

  try {
    if (await beforeSave(rec, req, res, isInsertMode)) {
      return null;
    }
  } catch (ex) {
    console.error("beforeSave threw an error", ex);
    let errStr = ex.message || "Error on saving record.";
    req.flash('error', errStr);
    res.redirect(getRedirectAfter(rec, req, queryModelName));  
    
    return null;
  }


  if (web.ext && web.ext.dbUtils) {
    await web.ext.dbUtils.save(rec, req);
  } else {
    await rec.save();
  }

  return rec;
}


function handleModelSchemaForColObj(modelSchema, colName, colMap, rec) {
  let colMapObj = colMap[colName];
  if (modelSchema[colName]) {
    let attr = modelSchema[colName];
    if (!colMap[colName]) {
      colMap[colName] = {};
    }
    

    if (attr.default && rec[colName] === undefined) {
      // assign default values if non existing
      rec[colName] = attr.default;
    }
    colMapObj.required = colMapObj.required || attr.required;

    colMapObj.label = colMapObj.label || attr.dbeditDisplay || web.cms.dbedit.utils.camelToTitle(colName);
  }
}

function getRedirectAfter(rec, req, queryModelName) {
  let redirectAfter = 'save?_id=' + encodeURIComponent(rec._id.toString());
  if (queryModelName) {
    redirectAfter += '&model=' + encodeURIComponent(queryModelName);
  }

  if (req.body._backUrl) {
    redirectAfter += '&_backUrl=' + encodeURIComponent(req.body._backUrl);
  }

  return redirectAfter;
}

function handleColObjMultiple(colMapObj, colName, rec) {
  colMapObj.multiple = colMapObj.multiple;

  if (colMapObj.multiple) {
    colMapObj.inputName = colName + '[]';
    if (!colMapObj.copies) {
      if (colMapObj.inputType === 'checkbox') {
        colMapObj.copies = 1;
      } else {
        colMapObj.copies = 3;
      }
      
    }

    if (rec[colName]
      && rec[colName].length > colMapObj.copies
      && colMapObj.inputType !== 'checkbox') {
      colMapObj.copies = rec[colName].length;
    }
    
  } else {
    colMapObj.inputName = colName;
    colMapObj.copies = colMapObj.copies || 1;
  }
}
