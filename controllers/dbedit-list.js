'use strict';

const dbeditUtils = require('../utils/dbeditUtils.js');

const pluginConf = web.plugins['braziw-plugin-dbedit'].conf;

module.exports = dbeditUtils.dbeditListController({
  enableDangerousClientFiltering: pluginConf.enableDangerousClientFiltering,
});