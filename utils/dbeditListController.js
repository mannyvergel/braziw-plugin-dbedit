'use strict';

const moment = web.require('moment-timezone');
const NON_EXISTENT_OBJ_ID = '5e848994cd0f31435cfdcea7';

module.exports = function({
  modelName,
  sort,
  cols,
  labels,
  listView,
  showAddButton = true,
  pageTitle,
  displayName,
  saveParams,
  rowsPerPage,
  caseInsensitiveSorting,
  includeVirtuals,

  populate,

  query,
  queryFilter,
  enableDangerousClientFiltering = false,

  handlers,

  shouldShowDeleteAction = true,
  editActionRedirect,
  editActionOnClick,
  parentTemplate,
  prefixActionCol = true,
  addUrl,
  saveUrl,
  colMap = {},

  beforeQuery,
  beforeRender,
  beforeDelete,

  beforeRenderAction,
  handlePostRequest,

  searchable = [],
  searchableNumFieldsPerRow = 2,
  searchableStyle = "max-width: 600px;",
  sortable = [],

  showExport = false,
  exportHandlers = {},
  exportCols,

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
      const querySaveParams = (saveParams && web.objectUtils.isFunction(saveParams) ? await saveParams(req) : saveParams) || ((enableDangerousClientFiltering && req.query.saveParams) || "");
      showAddButton = showAddButton || (enableDangerousClientFiltering && req.query.showAddButton === 'Y');

      parentTemplate = parentTemplate || web.cms.conf.adminTemplate;


      // this replaces the db query
      const queryQuery = query || (enableDangerousClientFiltering && req.query.query && JSON.parse(req.query.query));

      // this extends the db query
      const myQueryFilter = (enableDangerousClientFiltering && req.query.filter && JSON.parse(req.query.filter)) || await getQueryFilter(queryFilter, req);

      const queryShouldShowDeleteAction = shouldShowDeleteAction || (enableDangerousClientFiltering && req.query.shouldShowDeleteAction === 'Y');
      const queryEditActionRedirect = editActionRedirect || (enableDangerousClientFiltering && req.query.editActionRedirect);
      const queryEditActionOnClick = editActionOnClick || (enableDangerousClientFiltering && req.query.editActionOnClick);

      // need to copy as not to retain the objects from memory
      const mySearchable = searchable.map(a => ({...a}));
      
      let queryPrefixActionCol = enableDangerousClientFiltering && req.query.prefixActionCol === 'Y';

      prefixActionCol = prefixActionCol || queryPrefixActionCol;

      const queryModel = (enableDangerousClientFiltering && req.query.model);
      const modelStr = modelName || queryModel;
      //should be in cache by this time (assumption)
      const model = web.cms.dbedit.utils.searchModel(modelStr);
      const modelAttr = model.getModelDictionary();
      const modelSchema = modelAttr.schema;
      const modelAttrName = modelAttr.name;
      const modelDisplayName = queryDisplayName || modelAttr.displayName || modelAttr.name;
      const modelConf = web.cms.dbedit.utils.getModelConf(modelAttrName) || {};
      const sortDefault = {};
      sortDefault[web.cms.dbedit.conf.updateDtCol] = -1;

      const tableId = getPrefix(model);
      rowsPerPage = (req.query[tableId + '_rowsPerPage'] && parseInt(req.query[tableId + '_rowsPerPage']))
        || rowsPerPage || web.conf.defaultRowsPerPage;

      modelConf.sort = querySort || modelConf.sort || sortDefault;

      let myCols = [];

      if (prefixActionCol) {
        myCols.push({id: '_action', style: 'text-align: center;', excludeExport: true});
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
      if (prefixActionCol) {
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

      const myHandlers = Object.assign({}, handlers || modelConf.handlers || {});

      if (!saveUrl) {
        saveUrl = 'save';
      }

      if (!addUrl) {
        addUrl = saveUrl;
      }

      let colIds = [];
      for (let col of myCols || []) {
        if (web.objectUtils.isString(col)) {
          colIds.push(col);
          colMap[col] = Object.assign({}, colMap[col]);
        } else {
          colIds.push(col.id);
          colMap[col.id] = Object.assign({}, col, colMap[col.id]);
        }
      }

      if (colMap['_action'] && !myHandlers['_action']) {

        myHandlers['_action'] = async function(record, column, opts) {

            let actionArr = [];

            let queryModelParam = '';
            let queryModelHidden = '';
            let editActionOnClickStr = '';
            if (queryModel) {
              queryModelParam = '&model=' + encodeURIComponent(queryModel);
              queryModelHidden = `<input type="hidden" name="model" value="${queryModelParam}">`
            }

            if (queryEditActionOnClick) {
              editActionOnClickStr = `onclick="${editActionOnClick}"`
            }

            let saveUrl = queryEditActionRedirect || 'save';

            actionArr.push(
`<a title="Edit" ${editActionOnClickStr} class="btn btn-link btn-flatten-m" href="${saveUrl}?_backUrl=${encodeURIComponent(req.url)}&_id=${record._id.toString()}${queryModelParam}"">
<i class="fa fa-pencil"></i>
</a>`
            )

            const _csrf = req.csrfToken();

            if (queryShouldShowDeleteAction) {
              actionArr.push(
`<button title="Delete" name="ACTION_DELETE" type="submit" class="btn btn-link text-danger btn-flatten-m" onclick="return confirm(\'Are you sure you want to remove this course?\')">
<i class="fa fa-remove"></i>
</button>`
              );
            }

            if (beforeRenderAction) {
              await beforeRenderAction(actionArr, record, req);
            }

            return (`<div style="text-align: center; white-space: nowrap;"><form method="POST" style="display: inline;">
<input type="hidden" name="_id" value="${web.stringUtils.escapeHTML(record._id.toString())}">
<input type="hidden" name="_csrf" value="${web.stringUtils.escapeHTML(_csrf)}">
<input type="hidden" name="_backUrl" value="${web.stringUtils.escapeHTML(req.url)}">
${queryModelHidden}
${actionArr.join('')}
</form></div>`)


          }
      }

      
      for (let colName of colIds) {

        let dbCol = modelAttr.schema[colName];
        if (web.conf.timezone && dbCol && dbCol.type === Date) {
          if (!myHandlers[colName]) {
            myHandlers[colName] = async function(record, column, opts) {
              let rawVal = record[colName];
              let dateFormat = (colMap[colName] && colMap[colName].dateFormat) || web.conf.defaultDateTimeFormat || 'MM/DD/YYYY hh:mm A';
              if (rawVal) {
                return moment.tz(rawVal, web.conf.timezone).format(dateFormat);
              }

              return "";
            };
          } 
        } else if (colMap[colName] && colMap[colName].lookup) {
          if (!myHandlers[colName]) {
            myHandlers[colName] = async function(record, column, opts) {
              let rawVal = record[colName];
              if (rawVal) {
                return colMap[colName].lookup[rawVal] || rawVal;
              }

              return "";
            };
          }
        }
      }
      
      

      let myQuery = Object.assign({}, queryQuery || modelConf.query); //else query everything

      if (myQueryFilter) {
        myQuery = Object.assign(myQuery, myQueryFilter);
      }

      let fieldPerRowCounter = 0;
      let visibleLength = 0;
      let hasSearchVal = false;
      
      let searchableQuery = await getSearchableQuery(req, mySearchable, myQuery, {
        forEach: async function(searchObj) {
          if (!searchObj.hidden) {
            visibleLength++;
          }

          if (searchObj.val) {
            hasSearchVal = true;
          }

          if (searchObj.inputValues) {
            if (web.objectUtils.isFunction(searchObj.inputValues)) {
              searchObj.inputValuesComputed = await searchObj.inputValues(searchObj, req);
            } else {
              searchObj.inputValuesComputed = searchObj.inputValues;
            }
          }

          fieldPerRowCounter++;
          if (fieldPerRowCounter !== 1 && fieldPerRowCounter <= searchableNumFieldsPerRow) {
            searchObj.attachToPrevious = true;
          }

          if (fieldPerRowCounter > searchableNumFieldsPerRow) {
            fieldPerRowCounter = 1;
          }
        }
      });

      mySearchable.visibleLength = visibleLength;
      mySearchable.hasSearchVal = hasSearchVal;

      myQuery = Object.assign(myQuery, searchableQuery);


      if (beforeQuery) {
        await beforeQuery(myQuery, req, res, model);
      }

      const table = await web.renderTable(req, model, {
        tableId: tableId,
        query: myQuery,
        columns: myCols,
        labels: myLabels,
        includeVirtuals: includeVirtuals,
        populate: populate,
        sort: modelConf.sort,
        sortable: sortable,
        clientSortFunc: 'goSortColumn',
        rowsPerPage: rowsPerPage,
        caseInsensitiveSorting: caseInsensitiveSorting,
        handlers: myHandlers,
        req: req,
      });

      const myListView = queryListView || modelConf.view || web.cms.dbedit.conf.listView;
      const myPageTitle = queryPageTitle || modelConf.pageTitle || (modelDisplayName + ' List');

      let count;

      if (!myQuery || isObjectEmpty(myQuery)) {
        count = await model.estimatedDocumentCount();
      } else {
        count = await model.countDocuments(myQuery);
      }


      let rowsPerPageSelectVals = [10, 100, 500, 1000];
      if (rowsPerPage && rowsPerPageSelectVals.indexOf(rowsPerPage) === -1) {
        rowsPerPageSelectVals.push(rowsPerPage);
        rowsPerPageSelectVals.sort(function(a, b){
            return a - b;
        });
      }

      let options = {
        table: table,
        tableId: tableId,
        rowsPerPageSelectVals: rowsPerPageSelectVals,
        rowsPerPage: rowsPerPage,
        redirectAfter: redirectAfter,
        saveParams: querySaveParams,
        pageTitle: myPageTitle,
        modelName: modelAttrName,
        queryModelName: queryModel,
        showAddButton: showAddButton,
        searchable: mySearchable,
        searchableStyle: searchableStyle,
        modelDisplayName: modelDisplayName,
        filter: (myQueryFilter && JSON.stringify(myQueryFilter)),
        sort: (querySort && JSON.stringify(querySort)),
        count: count,
        parentTemplate: parentTemplate,
        addUrl: addUrl,
        origListView: web.cms.dbedit.conf.listView,
        showExport: showExport,
      }


      if (beforeRender) {
        await beforeRender(req, res, options);
      }

      res.render(myListView, options);


    },

    post: async function(req, res) {
      const modelStr = modelName || (enableDangerousClientFiltering && req.body.model);
      const recId = req.body._id;

      const model = web.cms.dbedit.utils.searchModel(modelStr);

      if (req.body.hasOwnProperty("ACTION_DELETE")) {
        if (!enableDangerousClientFiltering && !shouldShowDeleteAction) {
          throw new Error("Invalid access");
        }

        
        const modelAttr = model.getModelDictionary();
        const modelSchema = modelAttr.schema;

        const redirectAfter = req.body._backUrl;

        if (!recId) {
          throw new Error("Invalid request [3]");
        }

        let rec = await model.findOne({_id:recId}).exec();
        if (!rec) {
          throw new Error("Record not found.");
        }

        if (beforeDelete) {
          try {
            await beforeDelete(rec, req, res);
          } catch (ex) {
            console.warn("Error deleting", ex.message);
            req.flash('error', ex.message || 'Error deleting record');
            res.redirect(req.url);
            return;
          }
        }

        await rec.remove();
        req.flash('info', "Record has been deleted.");
        res.redirect(redirectAfter);
        
      } if (req.body.hasOwnProperty("_ACTION_EXPORT_CSV")) {
        const mySearchable = searchable.map(a => ({...a}));

        let myQuery = Object.assign({}, query, await getQueryFilter(queryFilter, req));

        let searchableQuery = await getSearchableQuery(req, mySearchable, myQuery);

        Object.assign(myQuery, searchableQuery);
        
        let myHandlers = Object.assign({}, handlers, exportHandlers);

        if (beforeQuery) {
          await beforeQuery(myQuery, req, res, model);
        }

        await web.cms.dbedit.csvUtils.downloadCsv(req, res, model, {
          cols: exportCols || cols,
          query: myQuery,
          populate: populate,
          sort: sort,
          handlers: myHandlers,
          includeVirtuals: includeVirtuals,
        });

      } else if (handlePostRequest) {
        await handlePostRequest(req, res);
      }
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

async function getQueryFilter(queryFilter, req) {
  return (web.objectUtils.isFunction(queryFilter) ? await queryFilter(req) : queryFilter)
}

async function getSearchableQuery(req, mySearchable, myQuery, {
  forEach
} = {}) {
  let searchableQuery = {};

  for (let searchObj of mySearchable) {
    
    let sParamVal = req.query['f_' + searchObj.id] || myQuery[searchObj.id] || searchObj.default;

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
        let assignedSearchVal = sParamVal;
        let isString = web.objectUtils.isString(assignedSearchVal);
        if (isString) {
          assignedSearchVal = assignedSearchVal.trim()
        }
        if (isString
          && (searchObj.wildcardSearch || searchObj.wildcardSearch === undefined)) {

          // exact search if enclosed in quotes
          let isExactSearch = assignedSearchVal[0] === '"' && assignedSearchVal[assignedSearchVal.length - 1] === '"';
          if (isExactSearch) {
            assignedSearchVal = assignedSearchVal.substr(1, assignedSearchVal.length - 2);
          } else {
            assignedSearchVal = web.cms.dbedit.searchUtils.wrapSearch(assignedSearchVal);
          }

        }

        searchableQuery[searchObj.id] = assignedSearchVal;
      }
    }

    if (forEach) {
      await forEach(searchObj);
    }

  }

  return searchableQuery;
}