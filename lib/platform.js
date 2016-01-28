'use strict';

var path = require('path'),
    url = require('url'),
    util = require('util');
    
var Q = require('q');

var manifoldjsLib = require('manifoldjs-lib');

var PlatformBase = manifoldjsLib.PlatformBase,
    manifestTools = manifoldjsLib.manifestTools,
    CustomError = manifoldjsLib.CustomError,
    fileTools = manifoldjsLib.fileTools,
    iconTools = manifoldjsLib.iconTools;

var constants = require('./constants'),
    manifest = require('./manifest');
   
function Platform (packageName, platforms) {

  var self = this;

  PlatformBase.call(this, constants.platform.id, constants.platform.name, packageName, __dirname);

  // save platform list
  self.platforms = platforms;

  // override create function
  self.create = function (w3cManifestInfo, rootDir, options, callback) {

    self.info('Generating the ' + constants.platform.name + ' app...');
    
    var platformDir = path.join(rootDir, constants.platform.id);
    
    // convert the W3C manifest to a platform-specific manifest
    var platformManifestInfo;
    return manifest.convertFromBase(w3cManifestInfo)
      // if the platform dir doesn't exist, create it
      .then(function (manifestInfo) {
        platformManifestInfo = manifestInfo;         
        self.debug('Creating the ' + constants.platform.name + ' app folder...');
        return fileTools.mkdirp(platformDir);
      })
      // download icons to the app's folder
      .then(function () {
        self.debug('Downloading the ' + constants.platform.name + ' icons...');
        var icons = platformManifestInfo.content.icons;
        if (icons) {
          var downloadTasks = Object.keys(icons).map(function (size) {
            var iconPath = icons[size];
            var iconUrl = url.resolve(w3cManifestInfo.content.start_url, iconPath);
            var iconFilePath = path.join(platformDir, url.parse(icons[size]).pathname);
            return iconTools.getIcon(iconUrl, iconFilePath);
          });
          
          return Q.allSettled(downloadTasks).then(function (results) {
            results.forEach(function (result) {
              if (result.state === 'rejected') {
                self.warn('Error downloading an icon file. ' + result.reason.message);
              }
            });
          });
        }
      })
      // copy default platform icon
      .then(function () {
        return self.copyDefaultPlatformIcon(platformManifestInfo, '128', platformDir);
      })
      // copy the documentation
      .then(function () {
        return self.copyDocumentation(platformDir);
      })      
      // write generation info (telemetry)
      .then(function () {
        return self.writeGenerationInfo(w3cManifestInfo, platformDir);
      })
      // persist the platform-specific manifest
      .then(function () {
        self.debug('Copying the ' + constants.platform.name + ' manifest to the app folder...');
        var manifestFilePath = path.join(platformDir, 'manifest.json');
        return manifestTools.writeToFile(platformManifestInfo, manifestFilePath);
      })
      .then(function () {
        self.info('The ' + constants.platform.name + ' app was created successfully!');
      })
      .catch(function (err) {
        self.error(err.getMessage());
        return Q.reject(new CustomError('There was an error creating the ' + constants.platform.name + ' app.'));
      })
      .nodeify(callback);
  };
}

util.inherits(Platform, PlatformBase);

module.exports = Platform;
