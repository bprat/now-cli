#!/usr/bin/env node
'use strict';

var fileData,
    fs = require('fs'),
    program = require('commander'),
    request = require('request'),
    config = require('config'),
    chalk = require('chalk'),
    util = require('util'),
    path = require('path'),
    entityName,
    extension,
    contentColumn,
    instance = config.get('instance'),
    username = config.get(instance + '.creds.user'),
    password = config.get(instance + '.creds.passwd'),
    rootSrcDir = config.get(instance + '.root_src_dir'),
    table,
    workingFileName = './.now_working',
    workingFile = fs.readFileSync(workingFileName),
    workingFileContent;

    if(workingFile.length > 0) {
      workingFileContent = JSON.parse(workingFile);
    } else {
      workingFileContent = {};
    }
    var instanceWorking = workingFileContent[instance];
    if(typeof instanceWorking == 'undefined') {
      instanceWorking = {};
    }
    const { exec } = require('child_process');
require('events').EventEmitter.defaultMaxListeners = 0;

program
  .version('0.0.1')
  .command('pull <type> <files>')
  .description('Pull a script from ServiceNow')
  .option('-f, --force_pull', 'force pull')
  .action(function (type, files, options) {
    var forcePull = options.force_pull;
    console.log(chalk.yellow('pointing to %s'), instance);
    table = config.types[type].table;
    extension = config.types[type].extension;
    contentColumn = config.types[type].content_column;
    entityName = config.types[type].name;
    if(typeof table !== 'undefined') {
    //   console.log('table for %s is %s', type, table)
    }
    if(typeof files === 'undefined') {
        // no file(s) provided, quit
        console.log(chalk.red.bold('Missing file name, please provide one or more file names'));
        return;
    }
    files = files.split(',');
    for(var fileIndex = 0, fileCount = files.length; fileIndex < fileCount; fileIndex++) {
        var file = files[fileIndex];
        var options = {
            url: 'https://' + instance + '.service-now.com/api/now/table/' + table + '?sysparm_fields=sys_id,' + contentColumn + ',name,sys_updated_on&sysparm_query=name=' + file,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': "Basic " + new Buffer(username + ":" + password).toString("base64")
            }
        }
        var sys_id, name, last_pulled, sys_updated_on, local_updated_on;
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var parsedBody = JSON.parse(body);
                if(parsedBody.result.length == 0) {
                    console.log(chalk.bold.red('Object not found on the instance'));
                    return;
                }
                sys_updated_on = new Date(parsedBody.result[0].sys_updated_on + ' GMT');
                name = parsedBody.result[0].name;
                sys_id = parsedBody.result[0].sys_id;
                var typeObject = instanceWorking[table];
                var fileName = name + '.' + extension;
                var fileDir = rootSrcDir + entityName + '/';
                var sep = path.sep;
                var initDir = path.isAbsolute(fileDir) ? sep : '';
                fileDir.split(sep).reduce((parentDir, childDir) => {
                    const curDir = path.resolve(parentDir, childDir);
                    if (!fs.existsSync(curDir)) {
                        fs.mkdirSync(curDir);
                    }
                  return curDir;
                }, initDir);
                // if (!fs.existsSync(fileDir)){
                //     fs.mkdirSync(fileDir);
                // }
                var completeFilePath = fileDir + fileName;
                if(typeof typeObject == 'undefined') {
                    typeObject = {};
                }
                if(forcePull !== true && typeof typeObject[name] !== 'undefined') {
                    var stats = fs.statSync(completeFilePath);
                    var mtime = new Date(util.inspect(stats.mtime));
                    last_pulled = new Date(typeObject[name].last_pulled);
                    local_updated_on = new Date(mtime);
                    console.log(chalk.yellow('local update time - %s'), local_updated_on);
                    console.log(chalk.yellow('pulled time - %s'), last_pulled);
                    console.log(chalk.yellow('remote update time - %s'), sys_updated_on);
                    if(local_updated_on > last_pulled) {
                        console.log(chalk.red.bold('file was updated locally, aborting pull'));
                        // open up a diff
                        var completeTempFilePath = completeFilePath + '.temp';
                        fs.open(completeTempFilePath, 'w+', function(err, fd) {
                            if (err) {
                                console.log('error opening file: ' + err);
                                throw 'error opening file: ' + err;
                            }

                            fs.writeFile(completeTempFilePath, parsedBody.result[0]['contentColumn'], function (err) {
                                if (err) {
                                    return console.log(err);
                                } else {
                                    console.log(chalk.bold.green('successfully created temp file %s and opening diff'), name+'.temp');
                                }
                            });
                        });
                        var diffCmd = util.format('p4m.sh %s %s',completeFilePath, completeTempFilePath);
                        exec(diffCmd, (err, stdout, stderr) => {
                            if (err) {
                                // node couldn't execute the command
                                return;
                            }
                        });
                        // return;
                    }
                    if(sys_updated_on < local_updated_on) {
                        console.log(chalk.blue('local copy latest'))
                    }
                }
                typeObject[name] = {
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

                    fs.writeFile(completeFilePath, parsedBody.result[0][contentColumn], function (err) {
                        if (err) {
                            return console.log(err);
                        } else {
                            console.log(chalk.bold.green('successfully pulled %s'), name);
                        }
                    });
                });

                fs.writeFile(workingFileName, JSON.stringify(workingFileContent, null, 2), function (err) {
                    if (err) return console.log(err);
                });
            } else {
                console.log(chalk.bold.red('failed with status code - %s.\n%s'), response.statusCode, JSON.stringify(response));
            }
        });
    }
  });

program
  .version('0.0.1')
  .command('push <type> <file>')
  .description('Push file to the SN instance')
  //.option('-f', 'hard push')
  .action(function(type, file) {
      console.log(chalk.yellow('pointing to %s'), instance);
    table = config.types[type].table;
    var fileObj = instanceWorking[table][file];
    var filePath = fileObj['file'];
    contentColumn = config.types[type].content_column;
    console.log(chalk.green('pushing %s'), file);
    // console.log(fileObj);
    if(typeof fileObj !== 'undefined') {
      fs.readFile(filePath, 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        fileData = data;
        // console.log('fileData: %s', fileData);
        var options = {
          url: 'https://' + instance + '.service-now.com/api/now/table/' + table + '/' + fileObj['sys_id'],
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': "Basic " + new Buffer(username + ":" + password).toString("base64")
          },
          json: {}
        }
        options.json[contentColumn] = fileData;
        // console.log('options: %s', JSON.stringify(options));
        // Start the request
        request(options, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            // Print out the response body
            //console.log(body)
          } else {
            console.log(chalk.bold.red('failed with status code - %s.\n%s'), response.statusCode, JSON.stringify(response));
          }
        })
      });
    }
  });

program
  .version('0.0.1')
  .command('instance [name]')
  .description('Configure instance to point to')
  .action(function(name) {
    if(typeof name === 'undefined') {
        console.log(chalk.green.bold('pointing to %s'), instance);
    } else {
        var configFileName = './config/development.json';
        var configFile = fs.readFileSync(configFileName);
        var configFileContent = JSON.parse(configFile);
        if(!configFileContent[name] || typeof configFileContent[name] === 'undefined') {
            console.log(chalk.red.bold('missing instance configuration for %s, aborting'), name);
        } else {
            configFileContent['instance'] = name;
            fs.writeFile(configFileName, JSON.stringify(configFileContent, null, 2), function (err) {
                if (err) return console.log(err);
                else {
                    console.log(chalk.green.bold('now pointing to %s'), name);
                }
            });
        }
    }
});

program
  .version('0.0.1')
  .command('uset [name]')
  .description('Check local and remote instance configuration')
  .action(function() {
      // set/get current update set
});

program
  .version('0.0.1')
  .command('check_config')
  .description('Check local and remote instance configuration')
  .action(function() {
      // check config file entries
      // check instance config
      // check access to instance
      // check working file
      // check access to target dir
});

program
  .version('0.0.1')
  .command('status')
  .description('List out modified files that haven\'t been pushed')
  .action(function() {

});
program.parse(process.argv);
