'use strict';

const csv = require('fast-csv');


exports.downloadCsv = async function(req, res, model, opts) {
  const {filename = 'export.csv'} = opts;
  res.attachment(filename);
  try {
    await exports.writeToCsvStream(res, model, {req: req, ...opts}); 
  } finally {
    res.end();
  }
}


exports.writeToCsvStream = async function(out, model, opts={}) {

  let { aggregate, query } = opts;

  const {
    processRow,
    recordHandler,
    sort = {},
    cols = [],
    handlers = {},
    populate,
    includeVirtuals = false,
    caseInsensitiveSorting = false,
  } = opts;

  if (!aggregate && !query) query = {};
  console.log("Exporting csv", model.name, opts.req && opts.req.url)

  let colObjArray = [];

  for (let col of cols) {
    if (web.objectUtils.isString(col)) {
      colObjArray.push({id: col});
    } else {
      colObjArray.push(col);
    }
  }
  
  let modelBuild = undefined;
  let cursor = undefined;
  
  if (!aggregate) {
    modelBuild = model.find(query).sort(sort);
    
    if (!includeVirtuals) {
      modelBuild.lean();
    }
    
    if (caseInsensitiveSorting) {
      modelBuild.collation({locale: 'en'});
    }
    
    if (populate) {
      modelBuild.populate(populate);
    }

    cursor = modelBuild.cursor();
  } else {
    modelBuild = model.aggregate(aggregate);

    cursor = modelBuild.cursor().exec();
  }
  
  let docCounter = 0;
  const csvStream = csv.format({ headers: true });
  csvStream.pipe(out);
  let prom = new Promise(function(resolve, reject) {
    csvStream.on('end', resolve);
    csvStream.on('error', reject);
  });

  for (let record = await cursor.next(); record != null; record = await cursor.next()) {
    if (recordHandler) await recordHandler(record, opts);

    let objToWrite = {};
    for (let colObj of colObjArray) {
      opts.currIndex = docCounter;
      
      let colLabel = colObj.label || colObj.id;
      let colId = colObj.id;
      if (!colObj.excludeExport) {
        let assignedVal = null;
        if (handlers[colId]) {
          assignedVal = await handlers[colId](record, colId, opts);
        } else {
          assignedVal = await defaultHandler(record, colId, opts);
          if (colObj.lookup) {
            assignedVal = colObj.lookup[assignedVal] || assignedVal;
          }
        }

        objToWrite[colLabel] = assignedVal;

      }
    }
    
    if (processRow) objToWrite = await processRow(objToWrite, record, opts);
    if (objToWrite) csvStream.write(objToWrite);

    docCounter++;
  }

  csvStream.end();
  
  await prom;

  console.log("End of export csv", model.name);
}

async function defaultHandler(record, colId, opts) {
  let val = resolvePath(record, colId, '');
  if (val instanceof Date) {
    let dateTimeFormat = web.conf.defaultDateTimeFormat || 'MM/DD/YYYY h:mm a';
    val = web.dateUtils.formatDate(val, dateTimeFormat);
  }
  return val; 
}

function resolvePath(object, path, defaultValue) {
  return path.split('.').reduce((o, p) => o ? o[p] : defaultValue, object)
}