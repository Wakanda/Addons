var utils = require("./utils").utils;

/**
 *
 * @namespace Extension
 */
var WAM_BASE = utils.config.protocol + '://' + utils.config.domain;
var WAM_API_REST = WAM_BASE + utils.config.url;
var studioVersion = utils.getStudioVersionObject(studio.version, studio.buildNumber);
var extensions = {
  types: [
    'wakanda-themes',
    'wakanda-widgets',
    'wakanda-extensions',
    'wakanda-internal-extensions',
    'wakanda-modules',
    'wakandadb-drivers',
  ],
  local: [],
  remote: []
};

/**
 * @class actions
 * @type {object}
 */
var actions = {};

/**
 *
 * @memberof Extension
 * @param src {string} Path of the folder that will be copied.
 * @param dest {string} Destination path.
 * @param filter {RegularExpression} Regular expression matching the files that must be ignored during the copy.
 * @returns {boolean} True if copy was successful.
 */
function copyFolder(src, dest, filter) {
  var source = Folder(src);
  var files = source.files;
  var i;
  if (filter) {
    i = 0;
    while (i < files.length) {
      if (files[i].extension.match(filter)) {
        i++;
      } else {
        files.splice(i, 1);
      }
    }
  }
  var isFolderVoid = (files.length === 0);
  var isSubFoldersVoid = true;
  // condition d'arret
  if (source.folders.length === 0) {
    if (!isFolderVoid) {
      Folder(dest).create();
      i = 0;
      while (i < files.length) {
        files[i].copyTo(new File(dest + files[i].name), true);
        i++;
      }
      return false;
    } else {
      return true;
    }
  } else {
    source.forEachFolder(function (sub) {
      isSubFoldersVoid = copyFolder(sub.path, dest + sub.name + "/", filter) && isSubFoldersVoid;
    });
    if (isSubFoldersVoid && !isFolderVoid) {
      Folder(dest).create();
    }
  }
  i = 0;
  while (i < files.length) {
    files[i].copyTo(new File(dest + files[i].name), true);
    i++;
  }
  return isSubFoldersVoid && isFolderVoid;
}

function getID(githubURL) {
  return githubURL.substr(githubURL.lastIndexOf('/') + 1);
}

/**
 * @memberof Extension
 * Unzips the specified file in the same folder & renames the github named folder to the standard name expected by the studio (add-on name).
 * @param file {string} Path of the file to unzip.
 * @param addonID {string} ID of the add-on.
 * @param addonName {string} Name of the add-on.
 * @returns {boolean} True if succesful.
 */
function unzip(file, addonID, addonName, addonType) {
  var worker,
    command,
    fileLocation = file.substr(0, file.lastIndexOf('/'));
  addonType = addonType == "wakanda-internal-extensions" ? "wakanda-extensions" : addonType;
  if (Folder(getAddonsRootFolder(addonType).path + addonName).exists) Folder(getAddonsRootFolder(addonType).path + addonName).remove();
  if (os.isWindows) {
    var zipItLoaction = studio.extension.getFolder().path + "resources/sevenzip";
    zipItLoaction = zipItLoaction.replace(/\//g, "\\");
    var fileWin = file.replace(/\//g, "\\");
    var fileLocationWin = fileLocation.replace(/\//g, "\\");
    command = 'cmd /c 7z x -y "' + fileWin + '" -o"' + fileLocationWin + '" && cd ' + fileLocationWin + ' && move ' + addonName + '-* ' + addonName + '';
    worker = new SystemWorker(command, zipItLoaction);
    // Sandboxed mode (not working)
    //command = fileWin + ' -d ' + fileLocationWin + '\\' + addonName;
    //result = SystemWorker.exec('unzip', command, '', null, null);
    if (!worker.wait()) {
      return false;
    }
  } else {
    command = 'bash -c \'cd \"' + fileLocation + '\" ; unzip \"' + file + '\" ; mv ' + addonName + '-* ' + addonName + '\'';
    worker = new SystemWorker(command);
    // Sandboxed mode (needs the unzip.sh & adding it to the SystemWorkers.json)
    //command = fileLocation + '/ ' + file.substr(file.lastIndexOf('/')+1) + ' ' + addonName;
    //result = SystemWorker.exec('unzip', command, '', null, null);
    if (!worker.wait()) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the root folder on the disk where a specific type of add-on is stored.
 * @memberof Extension
 * @param addonType {string}
 * @returns {string} Add-on root folder.
 */
function getAddonsRootFolder(addonType) {
  var rootAddonsFolder = '';
  switch (addonType) {
  case 'wakanda-themes':
    if (studio.extension.storage.getItem('projectpath') != 'Favorites') {
      rootAddonsFolder = Folder(studio.extension.storage.getItem('projectpath') + 'Themes/');
    } else {
      rootAddonsFolder = FileSystemSync('THEMES_CUSTOM');
    }
    break;
  case 'wakanda-widgets':
    if (studio.extension.storage.getItem('projectpath') != 'Favorites') {
      rootAddonsFolder = Folder(studio.extension.storage.getItem('projectpath') + 'Widgets/');
    } else {
      rootAddonsFolder = FileSystemSync('WIDGETS_CUSTOM');
    }
    break;
  case 'wakanda-extensions':
    rootAddonsFolder = FileSystemSync('EXTENSIONS_USER');
    break;
  case 'wakanda-internal-extensions':
    var studioFolder = utils.getStudioFolder();
    rootAddonsFolder = Folder(studioFolder.path + 'Extensions/');
    break;
  case 'wakanda-modules':
    rootAddonsFolder = Folder(studio.extension.storage.getItem('projectpath') + 'backend/modules/');
    break;
  case 'wakandadb-drivers':
    rootAddonsFolder = Folder(studio.extension.storage.getItem('projectpath') + 'drivers/');
    break;
  }
  return rootAddonsFolder;
}

function queryRestApi(query) {
  var xmlHttp = new studio.XMLHttpRequest();
  try {
    xmlHttp.open('GET', query);
    xmlHttp.send();
  } catch(e) {
    studio.log(e);
  }
  return xmlHttp.response;
}

function loadExternalWidget(motherWidget, httpUrls) {
  var params = {};
  var returnvalue = true;
  var brancheName;
  for (var i = 0; i < httpUrls.length; i++) {
    if (httpUrls[i].match(/\//)) {
      if (httpUrls[i].match(/\/tree\//)) {
        brancheName = httpUrls[i].substring(httpUrls[i].lastIndexOf('/tree/') + 6, httpUrls[i].length);
        httpUrls[i] = httpUrls[i].substring(0, httpUrls[i].lastIndexOf('/tree/'));
      } else {
        brancheName = 'master';
      }
      if (httpUrls[i].match(/\.git/g)) {
        params.name = httpUrls[i].substr(httpUrls[i].lastIndexOf('/') + 1, httpUrls[i].indexOf('.git') - httpUrls[i].lastIndexOf('/') - 1);
      } else {
        params.name = httpUrls[i].substring(httpUrls[i].lastIndexOf('/') + 1, httpUrls[i].length);
      }
      if (!studio.extension.storage.getItem('externals').match(params.name)) {
        params.git_url = httpUrls[i].replace('github.com', 'api.github.com/repos');
        params.git_url = params.git_url.replace(/.git$/g, '');
        params.name = params.git_url.substring(params.git_url.lastIndexOf('/') + 1, params.git_url.length);
        params.zip_url = httpUrls[i].replace('.git', '') + '/archive/' + brancheName + '.zip';
        params.type = 'wakanda-widgets';
        params.brancheName = brancheName;
        studio.extension.storage.setItem('addonParams', escape(JSON.stringify(params)));
        // if (studio.confirm("The " + motherWidget + " uses another widget called " + params.name + ". Would you like to install the " + params.name + " widget ?")) {
        studio.extension.storage.setItem('externals', studio.extension.storage.getItem('externals') + ',' + params.name);
        if (Folder(getAddonsRootFolder(params.type).path + params.name).exists) {
          studio.sendCommand('Addons.backup');
        }
        returnvalue = returnvalue && studio.sendCommand('Addons.downloadExt');
        if (studio.extension.storage.getItem('ERROR').match(/found/)) studio.alert('the ' + params.name + ' widget does not exist in GitHub');
        // }
      }
    } else {
      var response = queryRestApi(WAM_API_REST + '?$filter="name=' + httpUrls[i] + '"');
      var addonsitems = JSON.parse(response).__ENTITIES;
      if (addonsitems.length > 0) {
        var dataObj = {};
        item = addonsitems[0];
        dataObj.ID = item.ID;
        dataObj.name = item.name;
        if (!studio.extension.storage.getItem('externals').match(dataObj.name)) {
          dataObj.type = item.type;
          dataObj.hash = item.sha;
          // dataObj.html_url = item.html_url;
          // dataObj.git_url = item.git_url;
          // dataObj.owner = item.owner;
          // dataObj.description = item.description;
          // dataObj.created_at = item.created_at;
          // dataObj.updated_at = item.updated_at;
          // dataObj.pushed_at = item.pushed_at;
          // dataObj.downloads = item.downloads;
          // dataObj.githubID = getID(item.git_url);
          // dataObj.license = item.license;
          // dataObj.licenseAddress = item.licenseAddress;
          studio.extension.storage.setItem('addonParams', escape(JSON.stringify(dataObj)));
          studio.sendCommand('Addons.check');
          if ((studio.extension.storage.getItem(dataObj.name) == 'Upgrade') && (studio.confirm("the Widget " + dataObj.name + " already exists in your Project, do you want to override it ?"))) {
            studio.extension.storage.setItem('externals', studio.extension.storage.getItem('externals') + ',' + dataObj.name);
            studio.sendCommand('Addons.backup');
            returnvalue = returnvalue && studio.sendCommand('Addons.downloadExt');
          }
          if (studio.extension.storage.getItem(dataObj.name) == 'Install') {
            studio.extension.storage.setItem('externals', studio.extension.storage.getItem('externals') + ',' + dataObj.name);
            returnvalue = returnvalue && studio.sendCommand('Addons.downloadExt');
          }
        }
      } else {
        studio.alert('The ' + httpUrls[i] + ' widget does not exist in the wakanda-packages repository.');
      }
    }
  }
  return returnvalue;
}

/**
 * Downloads an add-on from github and unzips it in the path expected by Wakanda Studio.
 * The errors are store in studio.extension.storage.getItem('ERROR') so they may be accessed from the extension's UI.
 * @memberof Extension
 * @param addonParams {object} Object containing the add-on's description.
 * @returns {boolean} True if successful.
 */
function loadAddon(addonParams) {
  var xmlHttp,
    theFile,
    zipUrl;
  var externalstatut = true;
  var rootAddonsFolder = addonParams.type == "wakanda-internal-extensions" ? getAddonsRootFolder("wakanda-extensions") : getAddonsRootFolder(addonParams.type);
  try {
    zipUrl = (addonParams.zip_url) ? addonParams.zip_url : WAM_BASE + '/download?id=' + addonParams.ID + '&sha=' + addonParams.hash;
    xmlHttp = new studio.XMLHttpRequest();
    xmlHttp.open('GET', zipUrl, true);
    xmlHttp.onreadystatechange = function () {
      if (xmlHttp.readyState === 4) {
        if ([301, 302, 303, 307, 308].indexOf(xmlHttp.status) > -1) {
          addonParams.zip_url = xmlHttp.getResponseHeader('Location');
          return loadAddon(addonParams);
        }
        if (xmlHttp.status !== 200 || !xmlHttp.response || !xmlHttp.response.size) {
          studio.log('Add-on cannot be found' + xmlHttp.status + xmlHttp.status + xmlHttp.response.size);
          studio.extension.storage.setItem('ERROR', 'Add-on cannot be found');
          return;
        }
        try {
          Folder(rootAddonsFolder.path.substring(0, rootAddonsFolder.path.length - 1)).create();
          theFile = File(rootAddonsFolder.path + "tmp.zip");
          if (theFile.exists) {
            theFile.remove();
          }
        } catch (e) {
          studio.extension.storage.setItem('alert', e.message);
          return;
        }
        try {
          xmlHttp.response.copyTo(theFile);
          if (!unzip(theFile.path, addonParams.ID, addonParams.name, addonParams.type)) {
            studio.extension.storage.setItem('alert', "error while unzipping");
            theFile.remove();
            return;
          }
          theFile.remove();
          Folder(rootAddonsFolder.path + addonParams.name + '-' + addonParams.hash).setName(addonParams.name);
          addonParams.brancheName = (addonParams.brancheName) ? addonParams.brancheName : 'master';
          Folder(rootAddonsFolder.path + addonParams.name + '-' + addonParams.brancheName).setName(addonParams.name);
          var jsonFile = File(rootAddonsFolder.path + addonParams.name + '/manifest.json');
          if (!jsonFile.exists) {
            jsonFile.create();
            saveText('{}', jsonFile);
          }
          var parsed = JSON.parse(jsonFile);
          parsed.hash = addonParams.hash;
          saveText(JSON.stringify(parsed), jsonFile.path);
          if (addonParams.type.indexOf('extension') != -1) {
            var isUpgrade = studio.extension.storage.getItem(addonParams.name) == "Upgrade";
            studio.extension.storage.setItem(addonParams.name, 'Restart');
            if (isUpgrade) {
              studio.extension.storage.setItem('alert', 'You must restart Wakanda Studio for changes to take effect for ' + addonParams.name + ' extension.');
            } else {
              studio.extension.storage.setItem('alert', 'You must restart Wakanda Studio to complete the installation of the ' + addonParams.name + ' extension. It will not be available until you restart Wakanda Studio.');
            }
          } else {
            studio.extension.storage.setItem(addonParams.name, 'Installed');
          }
          refreshLocalAddons();
        } catch (e) {
          studio.extension.storage.setItem('alert', e.message);
          return;
        }
        studio.extension.storage.setItem('addonParams', JSON.stringify(addonParams));
        if (externalstatut) {
          studio.extension.storage.setItem('ERROR', false);
        }
      }
    };
    xmlHttp.responseType = 'blob';
    xmlHttp.send();
  } catch (e) {
    return false;
  }
  return studio.extension.storage.getItem('ERROR') === false;
}

/**
 * Fetches the value of an add-on's parameter from its data object representation.
 * @memberof Extension
 * @param paramName {string}
 * @returns {string} The value of the specified parameter for this add-on.
 */
function getAddonParam(paramName) {
  return getAddonFromLocalStorage()[paramName];
}

function getAddonFromName(name) {
  if (name && name.length > 0) {
    var localIndex = utils.findItem(extensions.local, "name", name);
    if (localIndex > -1) {
      return extensions.local[localIndex];
    }
    var remoteIndex = utils.findItem(extensions.remote, "name", name);
    if (remoteIndex > -1) {
      return extensions.remote[remoteIndex];
    }
  } else {
    return false;
  }
}

function saveAddonsOnLocalStorage() {
  studio.extension.storage.setItem('extensions.local', JSON.stringify(extensions.local));
  studio.extension.storage.setItem('extensions.remote', JSON.stringify(extensions.remote));
}

/**
 * Makes a backup of the add-on that is currently passed in the storage.
 * The backup will be stored inside the backup subfolder of the root folder defined by the add-on's type.
 */
actions.backup = function backup() {
  //var addonParams = JSON.parse(unescape(studio.extension.storage.getItem('addonParams')));
  var pluginName = getAddonParam('name');
  var pluginType = getAddonParam('type');
  var rootAddonsFolder = pluginType == "wakanda-internal-extensions" ? getAddonsRootFolder("wakanda-extensions") : getAddonsRootFolder(pluginType);
  if (Folder(rootAddonsFolder.path + pluginName).exists) {
    copyFolder(rootAddonsFolder.path + pluginName, rootAddonsFolder.path + '_previously-installed-' + pluginType + '/' + pluginName + '-' + (new Date()).getTime() + '/');
    if (pluginName != 'Addons') Folder(rootAddonsFolder.path + pluginName).remove();
  }
};

/**
 * Updates the status of the add-on that is currently passed in the storage.
 * Possible values : 'Install', 'Restart', 'Upgrade' & 'Installed'.
 * If the status was previously set to Restart by the download system, the status change will be ignored until Wakanda Studio is restarted.
 */
actions.checkAddonStatusFromLocalStorage = function() {
  var addonName = studio.extension.storage.getItem('addonName');
  var addon = getAddonFromName(addonName);
  checkAddonStatus(addon);
};

function checkAddonsStatus(addons) {
  addons.forEach(function(addon) {
    checkAddonStatus(addon);
  });
}

function checkAddonStatus(addon) {
  var remoteIndex = utils.findItem(extensions.remote, "name", addon.name);
  if (remoteIndex < 0) {
    return false;
  }
  var remoteAddon = extensions.remote[remoteIndex];
  var addonFolder = {};
  var addonStatus = studio.extension.storage.getItem(addon.name);
  if (remoteAddon.type == "wakanda-internal-extensions" || remoteAddon.type == "wakanda-extensions") {
    // first search the extension in the Addons folder in documents
    addonFolder = Folder(getAddonsRootFolder("wakanda-extensions").path + addon.name);    
    if (!addonFolder.exists) {
      // if not found, search for it in the internal extensions
      addonFolder = Folder(getAddonsRootFolder("wakanda-internal-extensions").path + addon.name);    
    }
  } else {
    addonFolder = Folder(getAddonsRootFolder(remoteAddon.type).path + addon.name);
  }
  if (!addonFolder.exists) {
    addonStatus = 'Install';
    studio.extension.storage.setItem(addon.name, addonStatus);
    return false;
  }

  // retrieve addon manifest
  var addonManifest = utils.readLocalExtensionManifest(addonFolder);
  if (Object.keys(addonManifest).length === 0) {
    studio.extension.storage.setItem('ERROR', 'Add-on ' + addon.name + ' has an invalid manifest.json.');
    studio.extension.storage.setItem(addon.name, '');
    return false;
  }

  // check for update
  var hasUpdate = checkAddonUpdates(addonManifest, remoteAddon);
  // check updates
  if (hasUpdate) {
    addonStatus = 'Upgrade';
  } else if (addonStatus !== 'Restart') {
    addonStatus = 'Installed';
  }

  studio.extension.storage.setItem(addon.name, addonStatus);
  calculateUpdates();
  return false;
};

/**
 * Triggers the download of an add-on. The add-on's definition must be passed in the storage with the key 'addonParams'.
 * @returns {boolean}
 */
actions.downloadExt = function downloadExt(message) {
  if (typeof message !== 'undefined' && typeof message.params !== 'undefined') {
    studio.extension.storage.setItem('addonParams', JSON.stringify(message.params));
    if (typeof message.params.projectpath !== 'undefined') {
      studio.extension.storage.setItem('projectpath', message.params.projectpath);
    }
  }
  var addonParams = JSON.parse(unescape(studio.extension.storage.getItem('addonParams')));
  // check version and try to find hash
  var remoteIndex = utils.findItem(extensions.remote, "name", addonParams.name);
  if (remoteIndex < 0 && !addonParams.hash) {
    studio.log('Addon could not be found on the online database');
    return false;
  } else if (remoteIndex >= 0) {
    var remoteAddon = extensions.remote[remoteIndex];
    addonParams.hash = utils.getAddonHash(addonParams, remoteAddon);
    // check tags
    var latestCompatibleVersion = utils.addonLatestCompatibleVersion(remoteAddon, studioVersion);
    if (latestCompatibleVersion && latestCompatibleVersion.sha) {
      addonParams.hash = latestCompatibleVersion.sha;
    }
  }
  return loadAddon(addonParams);
};

exports.handleMessage = function handleMessage(message) {
  var actionName;
  actionName = message.action;
  if (!actions.hasOwnProperty(actionName)) {
    return false;
  } else {
    actions[actionName](message);
  }
};

/**
 * Displays the extension's main UI in a modal dialog window.
 */
actions.showDialog = function showDialog() {
  studio.extension.storage.setItem("reload", "NOK");
  studio.extension.storage.setItem('defaultTab', 'wakanda-extensions');
  if (studio.isCommandWarning("Addons.showDialog")) {
    studio.extension.storage.setItem('defaultSort', "status == 'Restart' || status == 'Upgrade'");
  } else {
    studio.extension.storage.setItem('defaultSort', 'name');
  }
  studio.extension.registerTabPage('./index.html', './app/assets/img/rsz_logo-addon.png');
  studio.extension.openPageInTab('./index.html', 'Add-ons Extension', false, "window");
};

actions.showThemesDialog = function showThemesDialog() {
  studio.extension.storage.setItem('defaultTab', 'wakanda-themes');
  studio.extension.storage.setItem('defaultSort', 'name');
  studio.extension.registerTabPage('./index.html', './app/assets/img/rsz_logo-addon.png');
  studio.extension.openPageInTab('./index.html', 'Add-ons Extension', false, "window");
};

/**
 * Displays an alert with the extension's interface. The content must be passed in the storage with the key 'alertMessage'.
 */
actions.reloadTab = function reloadTab() {
  studio.extension.storage.setItem("reload", "OK");
};

actions.removeAddon = function removeAddon() {
  var addonName = getAddonParam('name');
  var addonType = getAddonParam('type');
  var rootAddonsFolder = addonType == "wakanda-internal-extensions" ? getAddonsRootFolder("wakanda-extensions") : getAddonsRootFolder(addonType);
  if (rootAddonsFolder.exists) {
    Folder(rootAddonsFolder.path + addonName).remove();
  }
};

function checkAddonUpdates(addon, remoteAddon) {

  var branch = 'master', legacy = false;
  if (studioVersion.major < 1) {
    legacy = true;
    branch = "WAK" + studioVersion.major;
  }

  if (legacy) {
    // check commit sha differs, otherwise no updates
    sha = utils.findShaByBranch(remoteAddon.branchs.__ENTITIES, branch);
    if (addon.branchs.__ENTITIES[sha].sha === addon.hash) {
      return false;
    } else {
      return utils.addonIsCompatible(remoteAddon, studioVersion);
    }
  } else {
    // check version and try to find hash
    addon.hash = utils.getAddonHash(addon, remoteAddon);
    // check tags
    var latestCompatibleVersion = utils.addonLatestCompatibleVersion(remoteAddon, studioVersion);
    if (!latestCompatibleVersion) {
      return false;
    }
    var latestVersion = utils.addonLatestVersion(remoteAddon);
    if (latestVersion) {
      remoteAddon.latestVersion = latestVersion.version;
      remoteAddon.latestMinStudioVersion = latestVersion.minStudioVersion;
      remoteAddon.latestMaxStudioVersion = latestVersion.latestMaxStudioVersion;
    }
    // propose as update only latest version
    remoteAddon.version = latestCompatibleVersion.version;
    remoteAddon.sha = latestCompatibleVersion.sha;
    remoteAddon.hash = latestCompatibleVersion.hash;
    remoteAddon.minStudioVersion = latestCompatibleVersion.minStudioVersion;
    remoteAddon.maxStudioVersion = latestCompatibleVersion.maxStudioVersion;

    if (latestCompatibleVersion.sha === addon.hash || ! utils.compareStringVersions(addon.version, latestCompatibleVersion.version)) {
      return false;
    } else {
      return true;
    }
  }

  return false;
}

function getLocalExtensions() {
  extensions.local = [];
  var extensionsFolder = [];
  extensions.types.forEach(function(type) {
    var rootAddonsFolder = getAddonsRootFolder(type);
    var globalExtensions = Folder(rootAddonsFolder.path).folders;
    globalExtensions.sort(sortFolderListByCreationDate);
    extensionsFolder = extensionsFolder.concat(globalExtensions);
  });

  extensionsFolder.forEach(function(folder) {
    // retrieve addon manifest
    var addonManifest = utils.readLocalExtensionManifest(folder);
    if (Object.keys(addonManifest).length === 0) {
      studio.extension.storage.setItem('ERROR', 'Add-on ' + folder.name + ' has an invalid manifest.json.');
      studio.extension.storage.setItem(folder.name, '');
    } else {
      var localIndex = utils.findItem(extensions.local, "name", folder.name);
      if (localIndex < 0) {
        extensions.local.push(addonManifest);
      }
    }    
  });

}

function getRemoteExtensions() {
  extensions.remote = [];
  var response = queryRestApi(WAM_API_REST + '?$top=1000&$expand=branchs,dependencies,tags');
  try {
    var addons = JSON.parse(response).__ENTITIES;
    addons.forEach(function(addon) {
      addon.isCompatible = false;
      addon.latestCompatibleVersion = utils.addonLatestCompatibleVersion(addon, studioVersion);
      if (addon.latestCompatibleVersion) {
        addon.isCompatible = true;
        addon.version = addon.latestCompatibleVersion.version;
        addon.minStudioVersion = addon.latestCompatibleVersion.minStudioVersion;
        addon.maxStudioVersion = addon.latestCompatibleVersion.maxStudioVersion;
      }
    });
    extensions.remote = addons;
  } catch(e) {
    studio.log(e);
  }
}

function calculateUpdates() {
  var updatesCount = 0;
  extensions.local.forEach(function(extension) {
    // search for extension in remote
    var remoteIndex = utils.findItem(extensions.remote, "name", extension.name);
    if (remoteIndex > -1 && extensions.remote[remoteIndex].type.match(/extension/)) {
      // if found
      var hasUpdate = checkAddonUpdates(extension, extensions.remote[remoteIndex]);
      if (hasUpdate) {
        updatesCount++;
      }
    }
  });
  if (updatesCount == 0) {
    studio.setCommandWarning("Addons.showDialog", false);
  } else {
    studio.setCommandWarning("Addons.showDialog", true, updatesCount);
    studio.showMessageOnStatusBar(updatesCount + " updates ready to install", "error");
  }
}

function retrieveAddons() {
  getLocalExtensions();
  getRemoteExtensions();
  checkAddonsStatus(extensions.local);
  saveAddonsOnLocalStorage();
}

function refreshLocalAddons() {
  getLocalExtensions();
  checkAddonsStatus(extensions.local);
  saveAddonsOnLocalStorage();
}

actions.checkUpdates = function() {
  calculateUpdates();
};

actions.init = function() {
  try {
    retrieveAddons();
    calculateUpdates();
  } catch (e) {
    studio.log('The Add-ons server cannot be reached. ' + e);
  }
};

function sortFolderListByCreationDate(folderA, folderB) {
  return (folderA.creationDate > folderB.creationDate) ? 1 : -1;
}