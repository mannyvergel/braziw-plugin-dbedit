'use strict';

const pluginConf = web.plugins['braziw-plugin-dbedit'].conf;
const pluginPath = pluginConf.pluginPath;

module.exports = {
  saveView: pluginPath + "/views/dbedit-save.html",
  collectionsView: pluginPath + "/views/dbedit-collections.html",
  listView: pluginPath + "/views/dbedit-list.html",
  addToMenu: true,
  updateDtCol: 'updateDt',
  updateByCol: 'updateBy',
  enableDangerousClientFiltering: false,
  models: [],
}