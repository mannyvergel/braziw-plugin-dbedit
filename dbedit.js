module.exports = function DbEdit(pluginConf, web, next) {
  var pluginPath = pluginConf.pluginPath;
  pluginConf = web.utils.extend({
      saveView: pluginPath + "/views/dbedit-save.html",
      collectionsView: pluginPath + "/views/dbedit-collections.html",
      listView: pluginPath + "/views/dbedit-list.html",
    },
    pluginConf);

  var self = this;
  web.cms.dbedit = self;

  this.conf = pluginConf;

  web.applyRoutes(require('./conf/routes.js'));

  web.cms.adminMenu.push({
    headerText:'DB Editor',
    permissions: ['ADMIN'],
    items:[
      { text: 'Collections', link:'/admin/dbedit/collections'},
    ]
  })

  normaliseModels();

  next();
}

function normaliseModels() {
  var modelInfos = web.cms.dbedit.conf.models;
  for (var i in modelInfos) {
    var modelInfo = modelInfos[i];
    if (!modelInfo.name) {
      modelInfo.name = getModelNameFromPath(modelInfo.path);
    }
  }
}

function getModelNameFromPath(modelPath) {
  if (!modelPath) {
    return '';
  }

  var arrModelSplit = modelPath.split('/');
  var nameWithJs = arrModelSplit[arrModelSplit.length-1];
  return nameWithJs.split('.')[0];
}