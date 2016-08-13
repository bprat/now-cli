#!/usr/bin/env node
'use strict';

var fileData,
    fs = require('fs'),
    instance,
    program = require('commander'),
    request = require('request');

program
.version('0.0.1')
.command('pull <file>')
.description('Pull a script from ServiceNow')
.option('-f', 'force pull')
.action();

program
.version('0.0.1')
.command('push <file>')
.description('Push file to the SN instance')
.option('-f', 'hard push')
.action(function(file) {
  console.log('file: %s ', file);
  fs.readFile(file, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }
    fileData = data;
    console.log('fileData: %s', fileData);
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
