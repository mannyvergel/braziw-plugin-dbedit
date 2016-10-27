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

  next();
}