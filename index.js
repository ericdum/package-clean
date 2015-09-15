#!/usr/bin/env node
"use strict"

var fs = require('fs');
var cmd = require('commander');
var path = require('path');
var co = require('co');

var root = process.cwd();
var modules = {none: { unDeclared: {}}};
var excludes = {};
var systemModules = {
  "assert": true,
  "buffer": true,
  "child_process": true,
  "fs": true,
  "net": true,
  "http": true,
  "https": true,
  "cluster": true,
  "os": true,
  "console": true,
  "crypto": true,
  "dns": true,
  "url": true,
  "vm": true,
  "path": true,
  "events": true,
  "util": true,
  "punycode": true,
  "querystring": true,
  "readline": true,
  "repl": true,
  "stream": true,
  "string_decoder": true,
  "tls": true,
  "tty": true,
  "dgram": true,
  "v8": true,
  "zlib": true
};
function lookup(files) {
  //var filename = file.split('/').pop();
  //detectFile(filename, file, callback);
  return co(function* () {
    yield *walk(root, files, "none")
    //yield *detectFile(filename, file, "none");
  })
}

function *detectFolder(root, currentPackage) {
  var files = yield callback => fs.readdir(root, callback);
  currentPackage = currentPackage || "none";
  files = files || [];
  if (files.indexOf('package.json') >= 0) {
    try {
      var pjson = require(path.join(root, 'package.json'));
      currentPackage = root;
      var deps = pjson.dependencies || {};
      var devDeps = pjson.devDependencies || {};
      for (let i in deps) { deps[i] = false }
      for (let i in devDeps) { devDeps[i] = false }
      modules[currentPackage] = {
        dependencies: deps,
        devDependencies: devDeps,
        unDeclared: {}
      };
    } catch(e) {}
  }
  yield *walk(root, files, currentPackage);
}

function *walk(root, files, currentPackage) {
  for (let i = 0; i<files.length; i++) {
    if (typeof files[i] != 'string') continue;
    let _path = path.join(root, files[i]);
    yield *detectFile(files[i], _path, currentPackage);
  }
}

function *detectFile(file, _path, currentPackage) {
  if(excludes[file]) return;
  var stat = yield callback => fs.stat(_path, callback);
  if( stat.isDirectory() ) {
    if (file != 'node_modules') {
      yield *detectFolder(_path, currentPackage);
    }
  } else if (detectJS(file)) {
    yield *lookupDeps(_path, currentPackage);
  }
}

function *lookupDeps(file, currentPackage) {
  var p = [],
    push = function( m ) { return '\\' + p.push( m ) + '\\'; },
    pop = function( i ) { return p[i-1] },
    file = yield callback => fs.readFile(file, 'utf8', callback);
  file
  .replace(/\s/g, '') //空格
  .replace(/\\\\.*$/g, '') //单行注释
  .replace(/(\/\*(\n|.)*?\*\/)/g, '') //多行注释
  .replace(/\\./g, push) //反斜线
  .replace(/(".*?"|'.*?')/g, push) //字符串
  .replace(/require\(\\(\d+)\\\)/g, function(whole, i){
    var dep = pop(i).replace(/["']|\/.*/g, ''); //只保留第一段module名
    if (!dep.match(/^\./)) {
      if (modules[currentPackage].devDependencies && dep in modules[currentPackage].devDependencies) {
        modules[currentPackage].devDependencies[dep] = true;
      } else if (modules[currentPackage].dependencies && dep in modules[currentPackage].dependencies) {
        modules[currentPackage].dependencies[dep] = true;
      } else if (!systemModules[dep]) {
        modules[currentPackage].unDeclared[dep] = true;
      }
    }
    return whole;
  })
}

function detectJS(file){
  return file.trim().split('.').pop() === 'js';
}

function isRelative(_path) {
  return _path[0] !== '/';
}

function list(val) {
  return val.split(',');
}

cmd
.usage('[options] <folder|file...>')
.version('0.0.1')
.description('Search JS files and compare with package.json figure out which dependencies are unuse')
.option('-v, --verbose', 'increase verbosity')
.option('-E, --exclude <items>', 'exclude file or folder', list)
.action(function(_path){
  var exclude = cmd.exclude || []
  for (let i=0; i<exclude.length; i++) {
    excludes[exclude[i]] = true;
  }
  lookup(arguments)
  .then(function(){
    output(modules);
    process.exit(0);
  }, function(){
    console.log(arguments);
    process.exit(0);
  }).catch(function(){
    console.log(arguments);
    process.exit(0);
  });
})
.parse(process.argv);

function output(modules) {
  var durty = false;
  for(let pack in modules) {
    var deps = [];
    var devDeps = [];
    var unDeclared = [];
    processDeps(modules[pack].dependencies, deps)
    processDeps(modules[pack].devDependencies, devDeps)
    processDeps(modules[pack].unDeclared, unDeclared)
    if (deps.length || devDeps.length || unDeclared.length) {
      durty = true;
      console.log('======================================================================');
      if (pack != 'none') {
        console.log('In', path.join(pack, 'package.json'));
        if (deps.length) {
          var x = deps.length > 1 ? 's are' : ' is';
          console.log('Following dependencie'+x, 'un-used');
          for(let i=0; i<deps.length; i++) {
            console.log("\t", deps[i]);
          }
        }
        if (devDeps.length) {
          var x = devDeps.length > 1 ? 's are' : ' is';
          console.log('Following devDependencie'+x, 'un-used');
          for(let i=0; i<devDeps.length; i++) {
            console.log("\t", devDeps[i]);
          }
        }
        if (unDeclared.length) {
          var x = unDeclared.length > 1 ? 's are' : ' is';
          console.log('Following dependencie'+x, 'undeclared');
          for(let i=0; i<unDeclared.length; i++) {
            console.log("\t", unDeclared[i]);
          }
        }
      } else {
        var x = unDeclared.length > 1 ? 's are' : ' is';
        console.log('Following dependencie'+x, 'found');
        for(let i=0; i<unDeclared.length; i++) {
          console.log("\t", unDeclared[i]);
        }
      }
    }
  }

  if (!durty) {
    console.log('All Clear');
  }
}
function processDeps(object, array) {
  for(let key in object) {
    if(!object[key]) {
      array.push(key);
    }
  }
}
