(function (name, definition) {
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
    utils.validateAddonVersionEligibility = function(addon, version) {
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

    return utils;
});