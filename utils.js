(function(name, definition) {
  if (typeof exports !== 'undefined') {
    exports[name] = definition();
  } else if (typeof module !== 'undefined') {
    module.exports = definition();
  } else if (typeof define === 'function' && typeof define.amd === 'object') {
    define(definition);
  } else {
    this[name] = definition();
  }
})('utils', function() {
  var utils = {};

  // config
  utils.config = {};
  utils.config = JSON.parse(studio.File(studio.extension.getFolder().path + 'config.json').toString());

  // find helper
  utils.findItem = function(arr, key, value) {
    if (!arr) return -1;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][key] === value) {
        return i;
      }
    }
    return -1;
  }

  // search for an addon commit sha by branch name, fallback on master
  utils.findShaByBranch = function(branches, branchName) {
    var sha = utils.findItem(branches, "branch", branchName);
    if (sha == -1) {
      sha = utils.findItem(branches, "branch", "master");
    }
    return sha;
  }

  // compare two versions arrays
  utils.compareVersions = function(shouldBeSmaller, shouldBeHigher) {
    switch (shouldBeSmaller.length) {
      case 3:
        if (shouldBeHigher[0] > shouldBeSmaller[0]) {
          return true;
        } else if (shouldBeHigher[0] == shouldBeSmaller[0]) {
          if (shouldBeHigher[1] > shouldBeSmaller[1]) {
            return true;
          } else if (shouldBeHigher[1] == shouldBeSmaller[1]) {
            if (shouldBeHigher[2] > shouldBeSmaller[2]) {
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
          if (shouldBeHigher[1] > shouldBeSmaller[1]) {
            return true;
          }
        }
        return false;
        break;
      case 1:
        if (shouldBeHigher[0] > shouldBeSmaller[0]) {
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

  // retro-compatibility with WAK < 1.1.0
  utils.getStudioVersionObject = function(studioVersion, buildNumber) {
    var studioVersionObject = {};

    if (typeof studioVersion === 'string') {
      // old isEnterprise call
      studioVersionObject.isEnterprise = studio.isEnterprise;

      // old dev versions
      studioVersionObject.isDev = (studioVersion == "Dev" || studioVersion == "0.0.0.0");

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

  // format addon and studio versions before comparing them, returns true if valid addon version
  utils.addonIsCompatible = function(addon, version) {
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
      check = utils.compareVersions(addonMinVersionArray, studioVersionArray);
    }

    if (check && addon.maxStudioVersion) {
      var addonMaxVersionArray = addon.maxStudioVersion.split('.').map(function(val) {
        return parseInt(val);
      });
      check = utils.compareVersions(studioVersionArray, addonMaxVersionArray);
    }

    return check;
  }

  // get addons manifest
  utils.readLocalExtensionManifest = function(addonFolder) {
    var addonManifest = {};

    // package.json was used in old Wakanda version
    var packageJsonFile = File(addonFolder.path + 'package.json');
    var packageJson = {};
    if (packageJsonFile.exists) {
      try {
        packageJson = JSON.parse(packageJsonFile);
      } catch (e) {
        //studio.log(e);
      }
    }

    // manifest.json is the actual standard package used by Wakanda
    var manifestJsonFile = File(addonFolder.path + 'manifest.json');
    var manifestJson = {};
    if (manifestJsonFile.exists) {
      try {
        manifestJson = JSON.parse(manifestJsonFile);
      } catch (e) {
        //studio.log(e);
      }
    }

    // first take all keys from package_json for retro-compatibility
    Object.keys(packageJson).forEach(function(key) {
      addonManifest[key] = packageJson[key]; 
    });

    // then take all keys from manifest_json and overwrite
    Object.keys(manifestJson).forEach(function(key) {
      addonManifest[key] = manifestJson[key];
    });

    // then take all keys from manifest_json.extension and overwrite
    if (manifestJson.extension) {
      Object.keys(manifestJson.extension).forEach(function(key) {
        addonManifest[key] = manifestJson.extension[key];
      });
    }

    if (Object.keys(addonManifest).length > 0) {
      addonManifest.name = addonFolder.name;
    } else {
      // invalid manifest
    }

    return addonManifest;
  }

  utils.getAddonHash = function(addon, remoteAddon) {
    var hash = null;

    if (addon.hash) {
      return addon.hash;
    }

    // tags detection mechanism
    if (remoteAddon.tags.__COUNT > 0) {
      // fetch tags
      if (addon.version) {
        // first search for a matching version
        remoteAddon.tags.__ENTITIES.forEach(function(tag) {
          // if found a tag with the same version of the version in the manifest, choose his sha
          if (tag.version == addon.version) {
            hash = tag.sha;
          }
        });
      }
    }

    return hash;
  };

  utils.addonLatestCompatibleVersion = function(addon, studioVersion) {
    var latest = null,
      latestVersion = null;

    var studioVersionArray = [
      parseInt(studioVersion.major),
      parseInt(studioVersion.minor),
      parseInt(studioVersion.patch)
    ];

    // if no tags return master latest commit
    if (addon.tags.__COUNT < 1) {
      var branchIdx = utils.findItem(addon.branchs.__ENTITIES, "branch", "master");
      if (branchIdx >= 0) {
        var branch = addon.branchs.__ENTITIES[branchIdx];
        // if found a tag with the same version of the version in the manifest, choose his sha
        var branchMinStudioVersion = branch.minStudioVersion ? 
          branch.minStudioVersion.split('.').map(function(val) {
            return parseInt(val);
          }) : null;
        var branchMaxStudioVersion = branch.maxStudioVersion ? 
          branch.maxStudioVersion.split('.').map(function(val) {
            return parseInt(val);
          }) : null;
        var branchVersion = branch.version ? 
          branch.version.split('.').map(function(val) {
            return parseInt(val);
          }) : null;

        var isMinCompatible = branchMinStudioVersion ? utils.compareVersions(branchMinStudioVersion, studioVersionArray) : true;
        var isMaxCompatible = branchMaxStudioVersion ? utils.compareVersions(studioVersionArray, branchMaxStudioVersion) : true;
        var isNewer = (branchVersion && latestVersion) ? utils.compareVersions(latestVersion, branchVersion) : true;

        if (isMinCompatible && isMaxCompatible && isNewer) {
          latest = branch;
          latestVersion = branchVersion;
        }
      }
    }

    // if tags return latest compatible tag comparing manifest.json { extension: { version: ?? } }
    addon.tags.__ENTITIES.forEach(function(tag) {
      // if found a tag with the same version of the version in the manifest, choose his sha
      var tagMinStudioVersion = tag.minStudioVersion ? 
        tag.minStudioVersion.split('.').map(function(val) {
          return parseInt(val);
        }) : null;
      var tagMaxStudioVersion = tag.maxStudioVersion ? 
        tag.maxStudioVersion.split('.').map(function(val) {
          return parseInt(val);
        }) : null;
      var tagVersion = tag.version ? 
        tag.version.split('.').map(function(val) {
          return parseInt(val);
        }) : null;

      var isMinCompatible = tagMinStudioVersion ? utils.compareVersions(tagMinStudioVersion, studioVersionArray) : true;
      var isMaxCompatible = tagMaxStudioVersion ? utils.compareVersions(studioVersionArray, tagMaxStudioVersion) : true;
      var isNewer = (tagVersion && latestVersion) ? utils.compareVersions(latestVersion, tagVersion) : true;

      if (isMinCompatible && isMaxCompatible && isNewer) {
        latest = tag;
        latestVersion = tagVersion;
      }
    });

    return latest;
  };

  utils.addonLatestVersion = function(addon) {
    var latest = null,
      latestVersion = null;

    if (addon.tags.__COUNT < 1) {
      var branchIdx = utils.findItem(addon.branchs.__ENTITIES, "branch", "master");
      if (branchIdx >= 0) {
        latest = addon.branchs.__ENTITIES[branchIdx];
      }
    }

    addon.tags.__ENTITIES.forEach(function(tag) {
      var tagVersion = tag.version ? 
        tag.version.split('.').map(function(val) {
          return parseInt(val);
        }) : null;

      var isNewer = (tagVersion && latestVersion) ? utils.compareVersions(latestVersion, tagVersion) : true;

      if (isNewer) {
        latest = tag;
        latestVersion = tagVersion;
      }
    });

    return latest;
  };

  utils.getStudioFolder = function() {
    var walibFolderPath = studio.getWalibFolder().path;
    return Folder(walibFolderPath).parent.parent.parent;
  };

  utils.compareStringVersions = function(smallerVersion, higherVersion) {
    var arraySmallerVersion = smallerVersion.split('.').map(function (val) {
      return parseInt(val);
    });
    var arrayHigherVersion = higherVersion.split('.').map(function (val) {
      return parseInt(val);
    });

    return utils.compareVersions(arraySmallerVersion, arrayHigherVersion);
  };

  return utils;
});