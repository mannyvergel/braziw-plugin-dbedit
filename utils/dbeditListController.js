'use strict';

const moment = web.require('moment-timezone');
const NON_EXISTENT_OBJ_ID = '5e848994cd0f31435cfdcea7';

module.exports = function({
  modelName,
  sort,
  cols,
  labels,
  listView,
  showAddButton,
  pageTitle,
  displayName,
  saveParams,
  rowsPerPage,
  caseInsensitiveSorting,

  populate,

  query,
  queryFilter,
  enableDangerousClientFiltering = false,

  handlers,

  shouldShowDeleteAction,
  editActionRedirect,
  editActionOnClick,
  parentTemplate,
  prefixActionCol,
  saveUrl,
  colMap = {},

  beforeRender,
  searchable = [],
  searchableStyle = "max-width: 600px;",
  sortable = [],

} = {}) {

  return {
    get: async function(req, res) {

      //customizable through get parameters:

      const querySort = (req.query.sort && JSON.parse(req.query.sort)) || sort;
      const queryCols = cols || (req.query.cols && JSON.parse(req.query.cols)); //db columns to add
      
      const queryLabels = labels || (req.query.labels && JSON.parse(req.query.labels)); //if cols is specified, and this is not, just convert to title case
      
      const queryListView = listView || (req.query.listView);
      const queryPageTitle = pageTitle || (req.query.pageTitle);
      const queryDisplayName = displayName || (req.query.displayName);
      const querySaveParams = (saveParams && web.objectUtils.isFunction(saveParams) ? await saveParams(req) : saveParams) || (req.query.saveParams || "");
      showAddButton = showAddButton || (req.query.showAddButton || "Y");

      parentTemplate = parentTemplate || web.cms.conf.adminTemplate;


      // this replaces the db query
      const queryQuery = query || (enableDangerousClientFiltering && req.query.query && JSON.parse(req.query.query));

      // this extends the db query
      const myQueryFilter = (enableDangerousClientFiltering && req.query.filter && JSON.parse(req.query.filter)) || (web.objectUtils.isFunction(queryFilter) ? await queryFilter(req) : queryFilter);

      const queryShouldShowDeleteAction = shouldShowDeleteAction || (req.query.shouldShowDeleteAction || 'Y');
      const queryEditActionRedirect = editActionRedirect || req.query.editActionRedirect;
      const queryEditActionOnClick = editActionOnClick || req.query.editActionOnClick;

      // need to copy as not to retain the objects from memory
      const mySearchable = searchable.map(a => ({...a}));

      prefixActionCol = prefixActionCol || req.query.prefixActionCol || 'Y';


      const modelStr = modelName || req.query.model;
      //should be in cache by this time (assumption)
      const model = web.cms.dbedit.utils.searchModel(modelStr);
      const modelAttr = model.getModelDictionary();
      const modelSchema = modelAttr.schema;
      const modelAttrName = modelAttr.name;
      const modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;
      const modelConf = web.cms.dbedit.utils.getModelConf(modelAttrName) || {};
      const sortDefault = {};
      sortDefault[web.cms.dbedit.conf.updateDtCol] = -1;

      modelConf.sort = querySort || modelConf.sort || sortDefault;

      let myCols = [];

      if (prefixActionCol === 'Y') {
        myCols.push('_action');
      } 

      let colsToAdd = queryCols || modelConf.cols;

      if (colsToAdd) {
        myCols.push(...colsToAdd);
      } else {
        colsToAdd = [];
        const maxColsDisplay = 4;
        let counter = 0;
        for (let i in modelSchema) {

          myCols.push(i);
          colsToAdd.push(i);

          counter++;
          if (counter > maxColsDisplay) {
            break;
          }
        }
      }



      let myLabels = [];
      if (prefixActionCol === 'Y') {
        myLabels.push('Action');
      } 

      let labelsToAdd = queryLabels || modelConf.labels;

      if (labelsToAdd) {
        myLabels.push(...labelsToAdd);
      } else {
        for (let colToAdd of colsToAdd || []) {
          let colName = web.objectUtils.isString(colToAdd) ? colToAdd : colToAdd.id;
          myLabels.push(web.cms.dbedit.utils.camelToTitle(colName));
        }
      }

      const redirectAfter = encodeURIComponent(req.url);
      handlers = handlers || modelConf.handlers || {};

      if (!saveUrl) {
        saveUrl = 'save';
      }

      if (myCols.findIndex(a=>a === "_action" || a.id === "_action") !== -1) {

        handlers['_action'] = function(record, column, escapedVal, callback) {
              let defaultActions = [];

              let editRedirect = queryEditActionRedirect 
                ? queryEditActionRedirect + '?_id=' + record._id 
                : saveUrl 
                  + '?model=' + (req.query.model || '')
                  + '&_id=' + record._id + '&_backUrl=' 
                  + redirectAfter + '&'  + querySaveParams;

              defaultActions.push('<a href="' + editRedirect + '" ' + (queryEditActionOnClick ? ('onclick="' + queryEditActionOnClick + '"') : '' ) + '><i class="fa fa-pencil fa-fw dbedit" style=""></i></a>');

              if (queryShouldShowDeleteAction === 'Y') {
                defaultActions.push('<a onclick="return confirm(\'Do you want to delete this record?\')" href="/admin/dbedit/delete?model=' 
                  + (req.query.model || '') + '&_id=' 
                  + record._id + '&_backUrl=' 
                  + redirectAfter + '"><i class="fa fa-remove fa-fw dbedit" style="color: red;"></i></a>');
              }
            callback(null, defaultActions.join(' '));
          }
      }

      if (web.cms.dbedit.conf.timezone) {
        for (let colName of myCols) {
          let dbCol = modelAttr.schema[colName];
          if (dbCol && dbCol.type === Date) {
            if (!handlers[colName]) {
              handlers[colName] = async function(record, column, escapedVal) {
                let rawVal = record[colName];
                let dateFormat = (colMap[colName] && colMap[colName].dateFormat) || 'MM/DD/YYYY hh:mm A';
                if (rawVal) {
                  return moment.tz(rawVal, web.cms.dbedit.conf.timezone).format(dateFormat);
                }

                return "";
              };
            } 
          }
        }
      }
      

      let myQuery = queryQuery || modelConf.query || {}; //else query everything

      if (myQueryFilter) {
        myQuery = Object.assign(myQuery, myQueryFilter);
      }

      let searchableQuery = {};
      for (let searchObj of mySearchable) {
        let sParamVal = req.query['f_' + searchObj.id] || myQuery[searchObj.id];

        if (sParamVal) {
          searchObj.val = sParamVal;

          if (searchObj.queryHandler) {
            let addtlSearchQuery = await searchObj.queryHandler(req, searchObj.val, searchObj, searchableQuery);
            if (addtlSearchQuery === null) {
              addtlSearchQuery = {};
              // force none existent ID
              addtlSearchQuery[searchObj.id] = NON_EXISTENT_OBJ_ID;
            }

            Object.assign(searchableQuery, addtlSearchQuery);
            
          } else {
            searchableQuery[searchObj.id] = sParamVal;
          }
        }
      }

      for (let i in searchableQuery) {
        let searchVal = searchableQuery[i];
        if (searchVal && web.objectUtils.isString(searchVal) && searchVal.indexOf('*') !== -1) {
          searchableQuery[i] = new RegExp(searchVal.replace(/\*/g, '.*'), 'i');
        }
      }

      myQuery = Object.assign(myQuery, searchableQuery);

      const tableId = getPrefix(model);
      const table = await web.renderTable(req, model, {
          tableId: tableId,
          query: myQuery,
          columns: myCols,
          labels: myLabels,
          populate: populate,
          sort: modelConf.sort,
          sortable: sortable,
          clientSortFunc: 'goSortColumn',
          rowsPerPage: rowsPerPage,
          caseInsensitiveSorting: caseInsensitiveSorting,
          handlers: handlers,
        });

      const myListView = queryListView || modelConf.view || web.cms.dbedit.conf.listView;
      const myPageTitle = queryPageTitle || modelConf.pageTitle || (modelDisplayName + ' List');

      let count;

      if (!myQuery || isObjectEmpty(myQuery)) {
        count = await model.estimatedDocumentCount();
      } else {
        count = await model.countDocuments(myQuery);
      }

      let options = {
        table: table,
        tableId: tableId,
        redirectAfter: redirectAfter,
        saveParams: querySaveParams,
        pageTitle: myPageTitle,
        modelName: modelAttrName,
        queryModelName: req.query.model,
        showAddButton: showAddButton,
        searchable: mySearchable,
        searchableStyle: searchableStyle,
        modelDisplayName: modelDisplayName,
        filter: (myQueryFilter && JSON.stringify(myQueryFilter)),
        sort: (querySort && JSON.stringify(querySort)),
        count: count,
        parentTemplate: parentTemplate,
        saveUrl: saveUrl,
        origListView: web.cms.dbedit.conf.listView,
      }

      if (beforeRender) {
        await beforeRender(req, res, options);
      }

      res.render(myListView, options);


    }
  }
    
}

function getPrefix(ModelObj) {
  return ModelObj.modelName.toLowerCase();
}

function isObjectEmpty(obj) {
      if (Object.getOwnPropertyNames) {
          return (Object.getOwnPropertyNames(obj).length === 0);
      } else {
          var k;
          for (k in obj) {
              if (obj.hasOwnProperty(k)) {
                  return false;
              }
          }
          return true;
      }
  }