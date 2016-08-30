#!/usr/bin/env node
'use strict';

var fileData,
    fs = require('fs'),
    program = require('commander'),
    request = require('request'),
    config = require('config'),
    colors = require('colors'),
    extension,
    username = config.get('creds.user'),
    password = config.get('creds.passwd'),
    instance = config.util.getEnv('NODE_APP_INSTANCE'),
    rootSrcDir = config.get('root_src_dir'),
    table,
    workingFileName = './.now_working',
    workingFile = fs.readFileSync(workingFileName),
    workingFileContent;

    if(workingFile.length > 0) {
      workingFileContent = JSON.parse(workingFile);
    } else {
      workingFileContent = {};
    }
    console.log('pointing to instance: ' + config.util.getEnv('NODE_APP_INSTANCE'));
    var instanceWorking = workingFileContent[instance];
    if(typeof instanceWorking == 'undefined') {
      instanceWorking = {};
    }

program
  .version('0.0.1')
  .command('pull <type> <file>')
  .description('Pull a script from ServiceNow')
  .option('-f', 'force pull')
  .action(function (type, file) {
    console.log('pulling %s of type %s', file, type);
    table = config.types[type].table;
    extension = config.types[type].extension;
    if(typeof table !== 'undefined') {
      console.log('table for %s is %s', type, table)
    }

    var options = {
      url: 'https://' + instance + '.service-now.com/api/now/table/' + table + '?sysparm_fields=sys_id,script,name,sys_updated_on&sysparm_query=name=' + file,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': "Basic " + new Buffer(username + ":" + password).toString("base64")
      }
    }
    var sys_id, name, last_pulled, sys_updated_on;
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // Print out the response body
        var parsedBody = JSON.parse(body);
        sys_updated_on = parsedBody.result[0].sys_updated_on;
        name = parsedBody.result[0].name;
        sys_id = parsedBody.result[0].sys_id;
        var typeObject = instanceWorking[table];
        var fileName = name + '.' + extension;
        var completeFilePath = rootSrcDir + type + '/' + fileName;
        if(typeof typeObject == 'undefined') {
          typeObject = {};
        }
        if(typeof typeObject[sys_id] !== 'undefined') {
          console.log(colors.green(typeObject[sys_id].last_pulled));
          console.log(colors.green(new Date(sys_updated_on + ' GMT')));
        }
        typeObject[sys_id] = {
          sys_id: sys_id,
          name: name,
          file: completeFilePath,
          sys_updated_on: new Date(sys_updated_on + ' GMT'),
          last_pulled: new Date()
        }
        instanceWorking[table] = typeObject;
        workingFileContent[instance] = instanceWorking;


        fs.open(completeFilePath, 'w+', function(err, fd) {
          if (err) {
              throw 'error opening file: ' + err;
          }

          fs.writeFile(completeFilePath, parsedBody.result[0].script, function (err) {
            if (err) return console.log(err);
          });
        });

        fs.writeFile(workingFileName, JSON.stringify(workingFileContent, null, 2), function (err) {
          if (err) return console.log(err);
          // console.log(colors.green(JSON.stringify(workingFileContent)));
        });
      } else {
        console.log('error: ' + response.statusCode);
      }
    });
  });

program
  .version('0.0.1')
  .command('push <file>')
  .description('Push file to the SN instance')
  //.option('-f', 'hard push')
  .action(function(file) {
    console.log('pushing %s ', file);
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) {
        return console.log(err);
      }
      fileData = data;
      // console.log('fileData: %s', fileData);
      var options = {
        url: 'https://' + instance + '.service-now.com/api/now/table/sys_script_include/9d1b62d0db95ea00dd6af93baf9619b4',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': "Basic " + new Buffer(username + ":" + password).toString("base64")
        },
        json: {'script': fileData}
      }
      // Start the request
      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          // Print out the response body
          //console.log(body)
        } else {
          console.log('error: ' + response.statusCode);
        }
      })
    });
  });

program.parse(process.argv);
