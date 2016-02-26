var utils = require("./js/utils").utils;
/**

 *

 * @namespace Extension

 */
var WAM_BASE = 'http://addons.wakanda.org/';

/**

 * @class actions

 * @type {object}

 */

var actions = {};

/**

 * Activates logging for the Extension side.

 * Studio.alert(...) sometimes crashes so we are outputting the debug messages to a file as an alternative.

 * @memberof Extension

 * @type {boolean}

 */

var DEBUGMODE = false;


// retro-compatibility with WAK < 1.1.0
function getStudioVersionObject (studioVersion, buildNumber) {
    var studioVersionObject = {};

    if (typeof studioVersion === 'string') {
        // old isEnterprise call
        if (studio.isEnterprise) {
            studioVersionObject.isEnterprise = true;
        } else {
            studioVersionObject.isEnterprise = false;
        }

        // old dev versions
        if (studioVersion == "Dev" || studioVersion == "0.0.0.0") {
            studioVersionObject.isDev = true;
        } else {
            studioVersionObject.isDev = false;
        }

        var studioVersionStringArray = [];
        if (buildNumber.length > 0) {
            studioVersionStringArray = buildNumber.split('.');
        } else {
            var studioVersionSplit = studioVersion.split(' ');
            studioVersionStringArray = studioVersionSplit[2].split('.');
        }

        // all WAK < 1.1.0 are labeled with old Wakanda versioning. From 1 to 11, converted logically in 0.1 to 0.11
        studioVersionObject.major = 0;
        // 0.0.0.0 are dev version, they are converted to 0.11
        if (studioVersionObject == "0.0.0.0") {
            studioVersionObject.minor = 11;
            studioVersionObject.patch = 0;
        } else {
            studioVersionObject.minor = studioVersionStringArray[0];
            studioVersionObject.patch = studioVersionStringArray[1];
        }

        studioVersionObject.full = [
            studioVersionObject.major,
            studioVersionObject.minor,
            studioVersionObject.patch
        ].join('.');

    } else if (typeof studioVersion === 'object') {
        studioVersionObject = studioVersion;
    }

    return studioVersionObject;
}

function compareVersions(shouldBeSmaller, shouldBeHigher) {
    switch(shouldBeSmaller.length) {
        case 3:
            if (shouldBeHigher[0] > shouldBeSmaller[0]) {
                return true;
            } else if (shouldBeHigher[0] == shouldBeSmaller[0]) {
                if (shouldBeHigher[1] > shouldBeSmaller[1]) {
                    return true;
                } else if (shouldBeHigher[1] == shouldBeSmaller[1]) {
                    if (shouldBeHigher[2] >= shouldBeSmaller[2]) {
                        return true;
                    }
                }
            }
            return false;
            break;
        case 2:
            if (shouldBeHigher[0] > shouldBeSmaller[0]) {
                return true;
            } else if (shouldBeHigher[0] == shouldBeSmaller[0]) {
                if (shouldBeHigher[1] >= shouldBeSmaller[1]) {
                    return true;
                }
            }
            return false;
            break;
        case 1:
            if (shouldBeHigher[0] >= shouldBeSmaller[0]) {
                return true;
            }
            return false;
            break;
        default:
            return true;
            break;
    }
    return true;
}

function validateAddonVersionEligibility(addon, version) {
    var studioVersionArray = [
        parseInt(version.major),
        parseInt(version.minor),
        parseInt(version.patch)
    ];
    var check = true;

    if (addon.minStudioVersion) {
        var addonMinVersionArray = addon.minStudioVersion.split('.').map(function(val) {
            return parseInt(val);
        });
        check = compareVersions(addonMinVersionArray, studioVersionArray);
    }

    if (check && addon.maxStudioVersion) {
        var addonMaxVersionArray = addon.maxStudioVersion.split('.').map(function(val) {
            return parseInt(val);
        });
        check = compareVersions(studioVersionArray, addonMaxVersionArray);
    }

    return check;
}

function findItem(arr, key, value) {
    if (!arr) return -1;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i][key] === value) {
            return (i);
        }
    }
    return -1;
}

function findShaByBranch(branches, branchName) {
    var sha = findItem(branches, "branch", branchName);
    if (sha == -1) {
        sha = findItem(branches, "branch", "master");
    }
    return sha;
}

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

    if (Folder(getAddonsRootFolder(addonType).path + addonName).exists)
        Folder(getAddonsRootFolder(addonType).path + addonName).remove();

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

        rootAddonsFolder = Folder(studio.extension.getFolder().path.replace("Addons/", ""));

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

            var query = WAM_BASE + 'rest/Addons/?$filter="name=' + httpUrls[i] + '"';

            var xmlHttp = new studio.XMLHttpRequest();

            xmlHttp.open('GET', query);

            xmlHttp.send();

            var addonsitems = JSON.parse(xmlHttp.response).__ENTITIES;

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

        zipUrl = (addonParams.zip_url) ? addonParams.zip_url : WAM_BASE + 'download?id=' + addonParams.ID + '&sha=' + addonParams.hash;

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

                    var jsonFile = File(rootAddonsFolder.path + addonParams.name + '/package.json');

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

                    }

                } catch (e) {

                    studio.extension.storage.setItem('alert', e.message);

                    return;

                }
                studio.extension.storage.setItem('addonParams', JSON.stringify(addonParams));

                if (externalstatut) {

                    studio.extension.storage.setItem('ERROR', 'ok');

                }

            }

        };

        xmlHttp.responseType = 'blob';

        xmlHttp.send();

    } catch (e) {

        return false;

    }

    return studio.extension.storage.getItem('ERROR') === 'OK';

}

/**

 * Writes a message to a log file. For debugging purposes only : this method does nothing when DEBUGMODE is active.

 * @memberof Extension

 * @param pluginName {string}

 * @param pluginType {string}

 * @param text {string}

 */

function writeLog(pluginName, pluginType, text) {


    if (DEBUGMODE) {

        var logFile = File(FileSystemSync('EXTENSIONS_USER').path + 'log.txt');

        var rootAddonsFolder = getAddonsRootFolder(pluginType);

        if (!logFile.exists) {

            logFile.create();

        }

        saveText(logFile + Folder(rootAddonsFolder.path + pluginName).path + ' (' + pluginType + ') : ' + text + '\n', logFile.path);

    }

}

/**

 * Fetches the value of an add-on's parameter from its data object representation.

 * @memberof Extension

 * @param paramName {string}

 * @returns {string} The value of the specified parameter for this add-on.

 */

function getAddonParam(paramName) {

    var addonParams = JSON.parse(unescape(studio.extension.storage.getItem('addonParams')));

    return addonParams[paramName];

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

        if (pluginName != 'Addons')
            Folder(rootAddonsFolder.path + pluginName).remove();
    }



};

/**

 * Updates the status of the add-on that is currently passed in the storage.

 * Possible values : 'Install', 'Restart', 'Upgrade' & 'Installed'.

 * If the status was previously set to Restart by the download system, the status change will be ignored until Wakanda Studio is restarted.

 */

actions.check = function check() {
    var rootAddonsFolder = '';

    var pluginName = getAddonParam('name');

    var pluginType = getAddonParam('type');

    var pluginHash = getAddonParam('hash');

    var fisrtCheck = studio.extension.storage.getItem('fisrtCheck');

    if (pluginType == "wakanda-internal-extensions" && fisrtCheck) {
        rootAddonsFolder = getAddonsRootFolder("wakanda-extensions");
    } else {
        rootAddonsFolder = getAddonsRootFolder(pluginType);
    }

    if (!Folder(rootAddonsFolder.path + pluginName).exists) {

        if (pluginType == "wakanda-internal-extensions" && fisrtCheck) {

            studio.extension.storage.setItem('fisrtCheck', false);
            studio.sendCommand('Addons.check');

        } else {

            studio.extension.storage.setItem(pluginName, 'Install');
        }


    } else {


        var jsonFile = File(rootAddonsFolder.path + pluginName + '/package.json');

        var parsed = {};

        try {


            parsed = (jsonFile.exists) ? JSON.parse(jsonFile) : {};

        } catch (e) {

            studio.extension.storage.setItem('fisrtCheck', false);

            studio.extension.storage.setItem('ERROR', 'Add-on ' + pluginName + ' has an invalid package.json.');

            studio.extension.storage.setItem(pluginName, '');

            return '';

        }

        if (pluginHash === parsed.hash) {


            if (studio.extension.storage.getItem(pluginName) !== 'Restart') {

                studio.extension.storage.setItem(pluginName, 'Installed');

            }

        } else {


            studio.extension.storage.setItem(pluginName, 'Upgrade');

        }

    }

    studio.extension.storage.setItem('fisrtCheck', false);

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

    // var pluginName = getAddonParam('name');

    // var pluginType = getAddonParam('type');


    return loadAddon(addonParams);

};

exports.handleMessage = function handleMessage(message) {

    var actionName;

    actionName = message.action;

    if (!actions.hasOwnProperty(actionName)) {

        if (DEBUGMODE) {

            studio.alert('I don\'t know about this message: ' + actionName + message.source.data);

        }

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

        studio.extension.storage.setItem('defaultSort', "status == 'Upgrade' || status == 'spin'");

    } else {

        studio.extension.storage.setItem('defaultSort', 'name');

    }


    studio.extension.registerTabPage('./addons.html', './img/rsz_logo-addon.png');

    studio.extension.openPageInTab('./addons.html', 'Add-ons Extension', false, "window");
};

actions.showThemesDialog = function showThemesDialog() {

    studio.extension.storage.setItem('defaultTab', 'wakanda-themes');

    studio.extension.storage.setItem('defaultSort', 'name');

    studio.extension.registerTabPage('./addons.html', './img/rsz_logo-addon.png');

    studio.extension.openPageInTab('./addons.html', 'Add-ons Extension', false, "window");
};

/**

 * Displays an alert with the extension's interface. The content must be passed in the storage with the key 'alertMessage'.

 */

actions.alert = function alert() {

    studio.alert(studio.extension.storage.getItem('alertMessage'));

    studio.extension.storage.setItem('alertMessage', '');

};
actions.reloadTab = function reloadTab() {

    studio.extension.storage.setItem("reload", "OK");

};
actions.checkForUpdate = function checkForUpdate(message) {

    if (message.source.data[0].name == "Widgets") {

        var studioVersion = getStudioVersionObject(studio.version, studio.buildNumber);
        var branch = 'master';
        if (studioVersion.major < 1) {
            branch = "WAK" + studioVersion.major;
        }

        var widgets = message.source.data[0].folders;

        var rootAddonsFolder = getAddonsRootFolder('wakanda-widgets');

        var query = WAM_BASE + 'rest/Addons/name,branchs,minStudioVersion,maxStudioVersion?$filter="visible=true"&$top=1000&$expand=branchs';

        var xmlHttp = new studio.XMLHttpRequest();

        xmlHttp.open('GET', query);

        xmlHttp.send();

        var addonsitems = JSON.parse(xmlHttp.response).__ENTITIES;

        var indexWidget, item, jsonFile, sha, eligibleForUpdate;
        var nbUpdates = 0;

        for (var i = 0; i < widgets.length; i++) {


            indexWidget = findItem(addonsitems, "name", widgets[i].name);



            if (indexWidget != -1) {

                item = addonsitems[indexWidget];

                jsonFile = File(rootAddonsFolder.path + item.name + '/package.json');

                var parsed = {};

                try {

                    parsed = (jsonFile.exists) ? JSON.parse(jsonFile) : {};

                } catch (e) {

                    studio.alert('Add-on ' + item.name + ' has an invalid package.json.');

                }


                eligibleForUpdate = true;
                // check commit sha differs, otherwise no updates
                sha = findShaByBranch(item.branchs.__ENTITIES, branch);
                if (item.branchs.__ENTITIES[sha].sha === parsed.hash) {
                    eligibleForUpdate = false;
                } else {
                    eligibleForUpdate = validateAddonVersionEligibility(item, studioVersion);
                }

                if (eligibleForUpdate) {
                    nbUpdates++;
                }

            }

        }

        if ( nbUpdates > 0)
            studio.setCommandWarning("Addons.showDialog", true, nbUpdates );
        else
            studio.setCommandWarning("Addons.showDialog", false);
    }

};
actions.removeAddon = function removeAddon() {

    var addonName = getAddonParam('name');

    var addonType = getAddonParam('type');

    var rootAddonsFolder = addonType == "wakanda-internal-extensions" ? getAddonsRootFolder("wakanda-extensions") : getAddonsRootFolder(addonType);

    rootAddonsFolder = Folder(rootAddonsFolder.path + addonName).exists ? rootAddonsFolder : getAddonsRootFolder(addonType);

    Folder(rootAddonsFolder.path + addonName).remove();

};


actions.checkForExtensionsUpdate = function checkForExtensionsUpdate() {

    try {

        var numberOfUpdate = 0;

        // branch selection
        var studioVersion = getStudioVersionObject(studio.version, studio.buildNumber);
        var branch = 'master';
        if (studioVersion.major < 1) {
            branch = "WAK" + studioVersion.major;
        }

        // global extensions
        var rootAddonsFolder = getAddonsRootFolder('wakanda-extensions');

        var globalExtensions = Folder(rootAddonsFolder.path).folders;

        globalExtensions.sort(sortFolderListByCreationDate);

        //internal extensions
        rootAddonsFolder = getAddonsRootFolder('wakanda-internal-extensions');

        var localExtensions = Folder(rootAddonsFolder.path).folders;

        localExtensions.sort(sortFolderListByCreationDate);

        var query = WAM_BASE + 'rest/Addons/name,type,branchs,minStudioVersion,maxStudioVersion?$filter="type=\'\*extensions\'"&$top=1000&$expand=branchs';

        var xmlHttp = new studio.XMLHttpRequest();

        xmlHttp.open('GET', query);

        xmlHttp.send();

        var addonsitems = JSON.parse(xmlHttp.response).__ENTITIES;

        var alreadyGlobal, indexExtension, parsed, item, jsonFile, sha, eligibleForUpdate;

        for (var i = 0; i < globalExtensions.length; i++) {

            indexExtension = findItem(addonsitems, "name", globalExtensions[i].name);

            if (indexExtension != -1) {

                item = addonsitems[indexExtension];

                jsonFile = File(globalExtensions[i].path + 'package.json');

                parsed = {};

                try {

                    parsed = (jsonFile.exists) ? JSON.parse(jsonFile) : {};

                } catch (e) {

                    studio.alert('Add-on ' + item.name + ' has an invalid package.json.');

                }

                eligibleForUpdate = true;
                // check commit sha differs, otherwise no updates
                sha = findShaByBranch(item.branchs.__ENTITIES, branch);
                if (item.branchs.__ENTITIES[sha].sha === parsed.hash) {
                    eligibleForUpdate = false;
                } else {
                    eligibleForUpdate = validateAddonVersionEligibility(item, studioVersion);
                }

                if (eligibleForUpdate) {
                    numberOfUpdate++;
                }

            }

        }



        for (i = 0; i < localExtensions.length; i++) {


            indexExtension = findItem(addonsitems, "name", localExtensions[i].name);

            alreadyGlobal = findItem(globalExtensions, "name", localExtensions[i].name);

            if (indexExtension != -1 && alreadyGlobal == -1 && addonsitems[indexExtension].type == "wakanda-internal-extensions") {

                item = addonsitems[indexExtension];

                jsonFile = File(localExtensions[i].path + 'package.json');

                parsed = {};

                try {

                    parsed = (jsonFile.exists) ? JSON.parse(jsonFile) : {};

                } catch (e) {

                    studio.alert('Add-on ' + item.name + ' has an invalid package.json.');

                }

                eligibleForUpdate = true;
                // check commit sha differs, otherwise no updates
                sha = findShaByBranch(item.branchs.__ENTITIES, branch);
                if (item.branchs.__ENTITIES[sha].sha == parsed.hash) {
                    eligibleForUpdate = false;
                } else {
                    eligibleForUpdate = validateAddonVersionEligibility(item, studioVersion);
                }

                if (eligibleForUpdate) {
                    numberOfUpdate++;
                }


            }

        }

        if (numberOfUpdate == 0) {
            studio.setCommandWarning("Addons.showDialog", false);
        } else {
            studio.showMessageOnStatusBar(numberOfUpdate + " updates ready to install", "error");
            studio.setCommandWarning("Addons.showDialog", true, numberOfUpdate);
        }
    } catch (e) {
        studio.alert(e)
    }


};

function sortFolderListByCreationDate(folderA, folderB) {

    return (folderA.creationDate > folderB.creationDate) ? 1 : -1;

}