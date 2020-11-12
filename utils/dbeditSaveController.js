'use strict';

const moment = require('moment-timezone');
const mongoose = web.require('mongoose');
const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

const OTHERS = {key: 'OTH', value: 'Others'};

module.exports = function({
  modelName,
  displayName,
  cols,
  colMap = {},
  enableDangerousClientFiltering = false,
  style,

  addPermission,
  editPermission,

  populate,

  // do you validations, extra save logic here
  // throw an error or handle it yourself by returning true
  beforeSave = (record, req, res)=>{}, 
  beforeRender,
  afterSave,

  parentTemplate,
  shouldShowDeleteAction = true,
  shouldShowSaveButton = true,

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

      let model = web.cms.dbedit.utils.searchModel(modelStr);
      // deep clone
      let modelAttr = model.getModelDictionary();
      let modelSchema = modelAttr.schema;

      let filterCols = (colIds.length > 0 ? colIds : null) 
        || (enableDangerousClientFiltering && req.query.filterCols && req.query.filterCols.split(','))
        || Object.keys(modelSchema);

      for (let colId of filterCols) {
        if (!colMap[colId]) {
          colMap[colId] = {};
        }
      }

      const readOnly = (enableDangerousClientFiltering && req.query.readOnly && req.query.readOnly.split(','));

      let myShouldShowDeleteAction = shouldShowDeleteAction;

      if (enableDangerousClientFiltering && req.query.shouldShowDeleteAction) {
        myShouldShowDeleteAction = req.query.shouldShowDeleteAction === "Y";
      }

      let myModelName = modelAttr.name;
      let modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;

      parentTemplate = parentTemplate || web.cms.conf.adminTemplate;
      
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

      if (req.session.recCache 
      && req.session.recCache[req.url]) {      
        rec = req.session.recCache[req.url];
        req.session.recCache[req.url] = null;
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

        if (colMapObj.colSpan) {
          colMapObj.colSpanStr = '-' + colMapObj.colSpan.toString();
        }

        if (colMapObj.inline) {
          colMapObj.inlineStr = " form-check-inline mr-2";
        }

        if (colMapObj.hideLabel === true) {
          colMapObj._hideLabel = colMapObj.hideLabel;
        } else {
          colMapObj._hideLabel = false;
        }

        if (colMapObj.addOthers) {
          colMapObj._addOthers = Object.assign({
            value: getVal(rec, colMapObj.addOthers.id),
            placeholder: 'If Others, please specify'
          }, colMapObj.addOthers);
        }

        if (colMapObj._addOthers) {
          colMapObj.inputValues.set(OTHERS.key, OTHERS.value)
        }
        
        handleModelSchemaForColObj(modelSchema, colName, colMap, rec)

        if (handlers[colName]) {
          colMapObj.htmlValue = await handlers[colName](rec, isUpdateMode, req);
        }


        handleColObjMultiple(colMapObj, colName, rec);

        if (colMapObj.inputValues && web.objectUtils.isFunction(colMapObj.inputValues)) {
          // need to do this to avoid the cache and overwriting the existing
          colMapObj.inputValuesFunc = colMapObj.inputValues;
        }

        if (colMapObj.inputValuesFunc) {
          colMapObj.inputValues = await colMapObj.inputValuesFunc(rec, req, isInsertMode);
        }

        colMapObj.readOnlyComputed = (readOnly && readOnly.indexOf(colName) !== -1)
          || (colMapObj.readOnly === 'U' && isUpdateMode)
          || (colMapObj.readOnly === 'I' && isInsertMode)
          || (web.objectUtils.isFunction(colMapObj.readOnly) && await colMapObj.readOnly(rec, req, isInsertMode))
          || colMapObj.readOnly === true;

        colMapObj.visibleComputed = true;
        if (colMapObj.visible !== undefined) {
          colMapObj.visibleComputed = await colMapObj.visible(rec, req, isInsertMode);
        }

        if (colMapObj.header) {
          colMapObj.headerComputed = (web.objectUtils.isFunction(colMapObj.header) && await colMapObj.header(rec, req, isInsertMode))
          || colMapObj.header;
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

      let myShowSaveButton = true;
      if (isUpdateMode && shouldShowSaveButton !== undefined) {
        myShowSaveButton = 
          (web.objectUtils.isFunction(shouldShowSaveButton) && await shouldShowSaveButton(rec, req, isInsertMode))
          || shouldShowSaveButton === true;
      }

      for (let submitBtnObj of additionalSubmitButtons) {
        submitBtnObj.visibleComputed = true;

        if (submitBtnObj.visible) {
          submitBtnObj.visibleComputed = await submitBtnObj.visible(rec, req, isInsertMode);
        }
      }

      let fileBackUrl = encodeURIComponent(req.url);

      let options = {
        rec: rec, 
        style: style,
        isUpdateMode: isUpdateMode,
        modelAttr: modelAttr,
        queryModelName: queryModel,
        pageTitle: pageTitle, 
        redirectAfter: redirectAfter,
        fileBackUrl: fileBackUrl,
        colMap: colMap,
        parentTemplate: parentTemplate,
        filterCols: filterCols,
        shouldShowDeleteAction: myShouldShowDeleteAction,
        shouldShowSaveButton: myShowSaveButton,
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

      if (isInsertMode) {
        if (addPermission && !req.user.hasPermission(addPermission)) {
          throw new Error("You don't have a permission to add this record.");
        }
      } else {
        if (editPermission && !req.user.hasPermission(editPermission)) {
          throw new Error("You don't have a permission to edit this record.");
        }
      }


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
          let date = attrToSet[colName];

          let dateFormat = 'MM/DD/YYYY'; 

          if (colMap[colName] && colMap[colName].inputType === "datetime") {
            dateFormat = 'MM/DD/YYYY hh:mm A';
          }

          if (!web.ext.dateTimeUtils.momentFromString(date, dateFormat).isValid()) {
            req.flash('error', `${colMap[colName].label} is an invalid date.`);
            res.redirect(req.url);
            return;
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
    req.session.recCache[req.url] = req.body;
    res.redirect(req.url);  
    
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

    colMapObj.label = colMapObj.label == null ? attr.dbeditDisplay || web.cms.dbedit.utils.camelToTitle(colName) : colMapObj.label;
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
    colMapObj._copies = colMapObj.copies;
    if (!colMapObj._copies) {
      if (colMapObj.inputType === 'checkbox') {
        colMapObj._copies = 1;
      } else {
        colMapObj._copies = 3;
      }
      
    }

    if (rec[colName]
      && rec[colName].length > colMapObj._copies
      && colMapObj.inputType !== 'checkbox') {
      colMapObj._copies = rec[colName].length;
    }
    
  } else {
    colMapObj.inputName = colName;
    colMapObj._copies = colMapObj._copies || 1;
  }
}

function getVal(recObj, key) {
  if (key.indexOf('.') == -1) {
    return recObj[key];
  } else {
    return web.objectUtils.resolvePath(recObj, key);
  }
}