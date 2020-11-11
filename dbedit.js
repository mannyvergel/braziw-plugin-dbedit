'use strict';

var dbeditUtils = require('./utils/dbeditUtils.js');
var fs = require('fs');

module.exports = function DbEdit(pluginConf, web, next) {
  var pluginPath = pluginConf.pluginPath;
  pluginConf = web.utils.extend({
      saveView: pluginPath + "/views/dbedit-save.html",
      collectionsView: pluginPath + "/views/dbedit-collections.html",
      listView: pluginPath + "/views/dbedit-list.html",
      addToMenu: true,
      updateDtCol: 'updateDt',
      updateByCol: 'updateBy',
      enableDangerousClientFiltering: false,
      models: [],
    },
    pluginConf);

  var self = this;
  web.cms.dbedit = self;
  web.cms.dbedit.utils = dbeditUtils;
  web.cms.dbedit.csvUtils = require('./utils/csvUtils.js');
  web.cms.dbedit.searchUtils = require('./utils/searchUtils.js');

  this.conf = pluginConf;

  web.addRoutes(require('./conf/routes.js'));

  if (pluginConf.addToMenu) {
    web.cms.adminMenu.push({
      headerText:'DB Editor',
      permissions: ['ADMIN'],
      items:[
        { text: 'Collections', link:'/admin/dbedit/collections'},
      ]
    })
  }

  setupModels();

  next();
}

function setupModels() {

  var modelInfos = web.cms.dbedit.conf.models;
  scanModelsDir(modelInfos);

  for (var i in modelInfos) {
    var modelInfo = modelInfos[i];
    if (!modelInfo.name) {
      modelInfo.name = getModelNameFromPath(modelInfo.path);
    }
  }
}

function getModelNameFromPath(modelPath) {
  if (!modelPath) {
    return null;
  }

  var arrModelSplit = modelPath.split('/');
  var nameWithJs = arrModelSplit[arrModelSplit.length-1];
  return nameWithJs.split('.')[0];
}

function scanModelsDir(modelInfos) {
  var files = fs.readdirSync(web.conf.baseDir + web.conf.modelsDir);
  for (var i in files) {
    var file = files[i];

    var modelName = getModelNameFromPath(file);

    if (!dbeditUtils.getModelConf(modelName) && web.stringUtils.endsWith(file, '.js')) {
      modelInfos.push({path: modelName});
    }
  }

}