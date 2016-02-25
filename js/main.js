var addonsApp = angular.module('addonsApp', ['ngResource', 'AddonsRest', 'angularUtils.directives.dirPagination']).filter('filterWithOr', function ($filter) {

    var comparator = function (actual, expected) {
        if (angular.isUndefined(actual)) {
            // No substring matching against `undefined`
            return false;
        }
        if ((actual === null) || (expected === null)) {
            // No substring matching against `null`; only match against `null`
            return actual === expected;
        }
        if ((angular.isObject(expected) && !angular.isArray(expected)) || (angular.isObject(actual) && !hasCustomToString(actual))) {
            // Should not compare primitives against objects, unless they have custom `toString` method
            return false;
        }

        actual = angular.lowercase('' + actual);
        if (angular.isArray(expected)) {
            var match = false;
            expected.forEach(function (e) {

                e = angular.lowercase('' + e);
                if (actual.indexOf(e) !== -1) {
                    match = true;
                }
            });
            return match;
        } else {
            expected = angular.lowercase('' + expected);
            return actual.indexOf(expected) !== -1;
        }
    };
    return function (array, expression) {
        return $filter('filter')(array, expression, comparator);
    };
});

addonsApp.controller('addonsCtrl', function ($scope, AddonsRest, $filter) {

    // ------------------------------------------------------------------------
    // Solution Infos
    // ------------------------------------------------------------------------
    solutionName = studio.currentSolution.getSolutionName();
    solutionFile = studio.currentSolution.getSolutionFile();
    solutionPath = solutionFile != null ? solutionFile.parent.path : {};
    solutionFilePath = solutionFile != null ? solutionFile.path : {};

    // Getting projects from solution XML
    function getProjectsFromXML() {

        solutionXml = studio.loadText(solutionFilePath);
        solutionJson = x2js.xml_str2json(solutionXml);

        var projects = [];

        angular.forEach(solutionJson.solution.project_asArray, function (value, key) {

            projects.push(studio.File(studio.currentSolution.getSolutionFile().parent.path + value._path));
        });

        return projects;
    }

    $scope.solutionInfos = {
        "solution": {
            "name": solutionName,
            "path": solutionPath,
            "file": {
                "path": solutionFilePath
            },
            "projects": solutionName ? getProjectsFromXML() : '' // if there is an opened solution
        },
        "studio": {
            "version": studio.version,
            "isEnterprise": studio.isEnterprise || studio.version.isEnterprise
        }
    };

    // call compareVersions to check addon and studio compatibilities
    function checkAddonVersionCompatibility(addon, studioVersionArray) {
        var isCompatible = true;

        if (addon.minStudioVersion) {
            var addonMinVersionArray = addon.minStudioVersion.split('.').map(function(val) {
                return parseInt(val);
            });
            isCompatible = compareVersions(addonMinVersionArray, studioVersionArray);
        }

        if (isCompatible && addon.maxStudioVersion) {
            var addonMaxVersionArray = addon.maxStudioVersion.split('.').map(function(val) {
                return parseInt(val);
            });
            isCompatible = compareVersions(studioVersionArray, addonMaxVersionArray);
        }

        return isCompatible;
    }
    
    // compare two versions arrays
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
    $scope.solutionInfos.studio.version = getStudioVersionObject($scope.solutionInfos.studio.version, studio.buildNumber);
    $scope.branch = "master";
    if ($scope.solutionInfos.studio.version.major < 1) {
        $scope.branch = "WAK" + $scope.solutionInfos.studio.version.minor;
    }
    $scope.solutionInfos.studio.version.array = [
        parseInt($scope.solutionInfos.studio.version.major),
        parseInt($scope.solutionInfos.studio.version.minor),
        parseInt($scope.solutionInfos.studio.version.patch)
    ];

    //console.group('Solution Infos');
    //console.log($scope.solutionInfos);
    //console.groupEnd();

    studio.extension.storage.setItem('ERROR', '');

    $scope.searchTerm = "";
    $scope.onlyInternal = false;
    // ------------------------------------------------------------------------
    // > TABS NAVIGATION (and main filter for the repeater)
    // ------------------------------------------------------------------------

    // Tab default if have projects else defaultTab = 'wakanda-extensions'
    if ($scope.solutionInfos.solution.projects.length > 0) {
        $scope.tabNav = studio.extension.storage.getItem('defaultTab');
    } else {
        $scope.tabNav = 'wakanda-extensions';
    }

    // Get category name from tab (wakanda-widgets -> widgets)
    $scope.$watch('tabNav', function (newVal, oldValue) {
        $scope.tabNavName = newVal.replace('wakanda-', '');
        // $scope.currentProject = $scope.projectsList[0];
        // studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);
        if (newVal == 'wakanda-modules') {
            $scope.projectsList.splice($scope.projectsList.length - 2, 2);
            if ($scope.currentProject.path == "Favorites") {
                $scope.currentProject = $scope.projectsList[0].path;
                $scope.changeCurrentProject($scope.currentProject);
            }
        }
        if (oldValue == 'wakanda-modules') {
            $scope.projectsList.push({
                "nameNoExt": '- - - - - - - - - - - - - -',
                "path": 'line',
                "disable": true
            }, {
                "nameNoExt": 'Favorites',
                "path": 'Favorites',
                "disable": false
            });

        }
    });

    // ------------------------------------------------------------------------
    // > SORT FILTER DEFAULT
    // ------------------------------------------------------------------------
    $scope.sortFilter = studio.extension.storage.getItem('defaultSort');
    $scope.sortOrder = false;

    $scope.$watch('sortFilter', function (criteria) {

        if (criteria == "name" || criteria == "owner")
            $scope.sortOrder = false;
        else
            $scope.sortOrder = true;

    });

    // ------------------------------------------------------------------------
    // > Split description from version info
    // ------------------------------------------------------------------------
    $scope.mySplit = function (s, nb) {

        $scope.array = s.split('<br>');

        return $scope.result = $scope.array[nb];

    };
    // ------------------------------------------------------------------------
    // > ADD CUSTOM REPO
    // ------------------------------------------------------------------------

    $scope.addCustomRepo = function () {

        var repoURL = studio.prompt('Enter the URL of the ' + $scope.tabNavName.substring(0, $scope.tabNavName.length - 1) + '\'s repository to import:', '');

        var brancheName;

        repoURL = repoURL.trim();

        if (repoURL == '' || repoURL == null || repoURL.length <= 0) {
            return false;
        }

        var params = {};

        repoURL = repoURL.replace(/\/$/, '');

        if (repoURL.match(/\/tree\//)) {
            brancheName = repoURL.substring(repoURL.lastIndexOf('/tree/') + 6, repoURL.length);
            repoURL = repoURL.substring(0, repoURL.lastIndexOf('/tree/'));
        } else {
            brancheName = 'master';
        }

        if (repoURL.match(/\.git/g)) {
            params.githubID = repoURL.substr(repoURL.lastIndexOf('/') + 1, repoURL.indexOf('.git') - repoURL.lastIndexOf('/') - 1);
        } else {
            params.githubID = repoURL.substring(repoURL.lastIndexOf('/') + 1, repoURL.length);
        }

        if (!repoURL.match(/github.com/)) {
            studio.alert('This is not a valid add-on url.');
            return false;
        }

        params.name = params.githubID;
        params.git_url = repoURL.replace('github.com', 'api.github.com/repos');
        params.git_url = params.git_url.replace(/.git$/g, '');
        params.zip_url = repoURL.replace(/.git$/g, '') + '/archive/' + brancheName + '.zip';
        params.type = $scope.tabNav;
        params.brancheName = brancheName;

        studio.extension.storage.setItem('addonParams', escape(JSON.stringify(params)));
        studio.extension.storage.setItem('externals', params.name);
        studio.sendCommand('Addons.downloadExt');

        studio.alert((studio.extension.storage.getItem('ERROR') === 'ok') ? 'The ' + params.name + ' ' + $scope.tabNavName + ' was installed successfully.' : params.name + ' ' + params.type + ' installation failed.');
        //console.log(studio.extension.storage.getItem('ERROR'));
        if ((studio.extension.storage.getItem('ERROR') === 'ok') && (params.type == "wakanda-extensions"))
            $("#freeow").freeow("Installation Info", studio.extension.storage.getItem('alert'), {
                classes: ["gray", "notice"],
                autoHide: false
            });
        studio.extension.storage.setItem('ERROR', '');

        return false;
    };

    // ------------------------------------------------------------------------
    // > GET ALL ADDONS (using AddonsRest Service)
    // ------------------------------------------------------------------------

    function callWam() {
        AddonsRest.getAddons.get().$promise.then(function (data) {
            $scope.error = false;
            angular.forEach(data.__ENTITIES, function (addon) {
                var issuesArray = addon.html_url.split('/');
                var finalUrl = '';

                for (i = 0; i < 5; i++) {
                    finalUrl += issuesArray[i] + '/';
                }

                finalUrl = finalUrl + '/issues/';
                addon.github_issues_url = finalUrl;

                // Adding github githubID
                addon.githubID = issuesArray[3];
                if (addon.keywords) {
                    addon.keywords = addon.keywords.replace(/","/g, ', ').replace('["', '').replace('"]', '');
                }
                addon.isCompatible = checkAddonVersionCompatibility(addon, $scope.solutionInfos.studio.version.array);
            });

            // Stock current tab addons


            // Handle tab change event and refresh addons list
            $scope.$watch('tabNav', function (selectedTab) {

                if (selectedTab == "wakanda-extensions") {

                    $scope.addons = $filter('filterWithOr')(data.__ENTITIES, {
                        type: [selectedTab, "wakanda-internal-extensions"]

                    });
                } else {
                    $scope.addons = $filter('filter')(data.__ENTITIES, {
                        type: $scope.tabNav

                    });

                }


                $scope.somethingToUpdate = findItem($scope.addons, 'status', 'Upgrade') != -1;
                changeAddonsHash();
                checkAddonsStatus();

            });

            $scope.$watch('branch', function (version) {
                if ($scope.tabNav == "wakanda-extensions") {

                    $scope.addons = $filter('filterWithOr')(data.__ENTITIES, {
                        type: [$scope.tabNav, "wakanda-internal-extensions"]
                    });
                } else {
                    $scope.addons = $filter('filter')(data.__ENTITIES, {
                        type: $scope.tabNav

                    });

                }

                $scope.somethingToUpdate = findItem($scope.addons, 'status', 'Upgrade') != -1;
                changeAddonsHash();
                checkAddonsStatus();

            });

            // $scope.$watch('category', function (selectedCategory) {
            // $scope.addons = $filter('filter')(data.__ENTITIES, {
            // type : $scope.tabNav
            // });
            // changeAddonsHash();
            // checkAddonsStatus();

            // });

            // Initial check for installed addons for the default selected project
            checkAddonsStatus();
            $scope.loaded = true;

        }, function (e) {

            // Error while accessing addons service
            //console.log('I cant access the addon list :(');
            $scope.error = true;
            $scope.addons = [{
                    "name": 'The Add-ons server cannot be reached. You may  <button ng-click="addCustomRepo();" class="button">add your library manually</button> or try again later.'
                }
            ];

            //console.log(e);

        });
        // End Service Call
    }

    callWam();
    // ------------------------------------------------------------------------
    // > GENERATE PROJECT DROPDOWN
    // ------------------------------------------------------------------------

    $scope.projectsList = [];

    angular.forEach($scope.solutionInfos.solution.projects, function (value, key) {

        $scope.projectsList.push({
            "nameNoExt": value.nameNoExt,
            "path": value.parent.path,
            "disable": false
        });
    });

    $scope.projectsList = $scope.projectsList.sort(function (a, b) {

        return a.nameNoExt.localeCompare(b.nameNoExt);

    });

    $scope.projectsList.push({
        "nameNoExt": '- - - - - - - - - - - - - -',
        "path": 'line',
        "disable": true
    }, {
        "nameNoExt": 'Favorites',
        "path": 'Favorites',
        "disable": false
    });

    // Set the selected project to 'first one'
    $scope.currentProject = $scope.projectsList[0].path;
    studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);

    // Reset the selected project to 'first one' when changing tab to wakanda-modules
    $scope.$watch('tabNav', function () {
        if ($scope.tabNav === 'wakanda-modules' && $scope.currentProject === 'Favorites') {
            $scope.currentProject = $scope.projectsList[0].path;
            studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);
        }
    });

    // ------------------------------------------------------------------------
    // > CHECK ADDON STATUS (install, installed, update, ...)
    // ------------------------------------------------------------------------
    function checkAddonsStatus() {

        angular.forEach($scope.addons, function (addon) {
            // Set Error Item to void string
            studio.extension.storage.setItem('ERROR', '');
            studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
            studio.extension.storage.setItem('fisrtCheck', true);
            studio.sendCommand('Addons.check');
            if (studio.extension.storage.getItem('ERROR') === '' || studio.extension.storage.getItem('ERROR') === 'ok') {

                addon.status = studio.extension.storage.getItem(addon.name);
            } else {
                addon.status = 'reboot';
            }
        });
    }

    function changeAddonsHash() {
        angular.forEach($scope.addons, function (addon) {
            var go = false;
            for (var i = 0; i < addon.branchs.__ENTITIES.length; i++) {
                addon.hash = addon.branchs.__ENTITIES[i].sha;
                addon.github_url = addon.html_url.replace(/\/tree\/.*/, "/tree/" + $scope.branch);
                if (!addon.license_url) {
                    addon.license_url = addon.github_url;
                }
                switch (addon.branchs.__ENTITIES[i].branch) {
                case $scope.branch:
                    go = $scope.branch;
                    break;
                default:
                    break;
                }
                if (go) {
                    break;
                }
            }
        });
    }

    function findItem(arr, key, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i][key] === value && arr[i].isCompatible) {
                return (i);
            }
        }
        return -1;
    }
    // ------------------------------------------------------------------------
    // > BUTTONS ACTIONS
    // ------------------------------------------------------------------------

    $scope.addonInstall = function (addon, dependencies) {
        if (addon != null && addon.isCompatible) {
            addon.status = "spin";
            studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
            studio.extension.storage.setItem('externals', addon.name);
            studio.extension.storage.setItem('alert', "No");
        }
        // addon.status = "spin";

        window.setTimeout(function () {
            if (addon != null && addon.isCompatible) {
                studio.sendCommand('Addons.downloadExt');
                studio.extension.storage.setItem('fisrtCheck', true);
                studio.sendCommand('Addons.check');

                addon.status = studio.extension.storage.getItem(addon.name);
                
                if (addon.status == "Installed")
                    addon.downloads = addon.downloads + 1;

                // checkAddonsStatus();
                if (studio.extension.storage.getItem('alert') != "No")

                    $("#freeow").freeow("Installation Info", studio.extension.storage.getItem('alert'), {
                    classes: ["gray", "notice"],
                    autoHide: false
                });

                $scope.$apply();

                studio.extension.storage.setItem('ERROR', '');

            }
            var newdependencies = dependencies.concat([]);

            var newaddon;
            if (newdependencies.length > 0) {

                newaddon = $scope.addons[findItem($scope.addons, "name", newdependencies.splice(0, 1)[0].name)];
                newdependencies = newdependencies.concat(newaddon.dependencies.__ENTITIES);
                switch (newaddon.status) {
                case 'Install':
                    $scope.addonInstall(newaddon, newdependencies);
                    break;
                case 'Upgrade':
                    $.confirm({
                        'title': 'Upgrade Confirmation',
                        'message': 'the ' + newaddon.name + ' widget already exists in your project. <br />Do you want to override it?',
                        'buttons': {
                            'Yes': {
                                'class': 'blue',
                                'action': function () {
                                    $scope.addonUpgrade(newaddon, newdependencies);
                                }
                            },
                            'No': {
                                'class': 'gray',
                                'action': function () {
                                    $scope.addonInstall(null, newdependencies);
                                }
                            }
                        }
                    });

                    break;
                default:
                    $scope.addonInstall(null, newdependencies);

                }
                $scope.$apply();
            }

        }, 500);

    };

    $scope.addonUpgrade = function (addon, dependencies) {
        if (!addon.isCompatible) {
            return false;
        }
        addon.status = "spin";
        studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
        studio.extension.storage.setItem('externals', addon.name);
        window.setTimeout(function () {
            //studio.sendCommand('Addons.backup');
            studio.sendCommand('Addons.downloadExt');
            studio.extension.storage.setItem('fisrtCheck', true);
            studio.sendCommand('Addons.check');

            addon.status = studio.extension.storage.getItem(addon.name);
            if (addon.status == "Installed")
                addon.downloads = addon.downloads + 1;

            if (studio.extension.storage.getItem('alert') != "No")

                $("#freeow").freeow("Upgrade Info", studio.extension.storage.getItem('alert'), {
                classes: ["gray", "notice"],
                autoHide: false
            });

            $scope.$apply();
            studio.extension.storage.setItem('ERROR', '');
            var newdependencies = dependencies.concat([]);
            var newaddon;
            if (newdependencies.length > 0) {

                newaddon = $scope.addons[findItem($scope.addons, "name", newdependencies.splice(0, 1)[0].name)];
                newdependencies = newdependencies.concat(newaddon.dependencies.__ENTITIES);

                if (!newaddon.isCompatible) {
                    return false;
                }

                switch (newaddon.status) {
                case 'Install':
                    $scope.addonInstall(newaddon, newdependencies);
                    break;
                case 'Upgrade':
                    if (newaddon.type == "wakanda-widgets") {
                        $.confirm({
                            'title': 'Upgrade Confirmation',
                            'message': 'the ' + newaddon.name + ' widget already exists in your project. <br />Do you want to override it?',
                            'buttons': {
                                'Yes': {
                                    'class': 'blue',
                                    'action': function () {
                                        $scope.addonUpgrade(newaddon, newdependencies);
                                    }
                                },
                                'No': {
                                    'class': 'gray',
                                    'action': function () {
                                        $scope.addonInstall(null, newdependencies);
                                    }
                                }
                            }
                        });
                    } else {

                        $scope.addonUpgrade(newaddon, newdependencies);
                    }
                    break;
                default:
                    $scope.addonInstall(null, newdependencies);

                }
                $scope.$apply();
            }

            if (findItem($scope.addons, 'status', 'Upgrade') == -1) {

                studio.setCommandWarning("Addons.showDialog", false);
            }

        }, 500);
    };

    $scope.upgradeAll = function () {

        var nextUpdate = findItem($scope.addons, 'status', 'Upgrade');
        $scope.somethingToUpdate = nextUpdate != -1;
        var allUpdate = [];

        while ($scope.somethingToUpdate) {

            allUpdate.push({
                "name": $scope.addons[nextUpdate].name
            })
            $scope.addons[nextUpdate].status = "spin"
            nextUpdate = findItem($scope.addons, 'status', 'Upgrade');
            $scope.somethingToUpdate = nextUpdate != -1;
        }
        while (findItem($scope.addons, 'status', 'spin') != -1) {


            $scope.addons[findItem($scope.addons, 'status', 'spin')].status = "Upgrade";
        }
        var firstUpdate = $scope.addons[findItem($scope.addons, "name", allUpdate.splice(0, 1)[0].name)];
        $scope.addonUpgrade(firstUpdate, allUpdate);


    }

    $scope.reloadTab = function () {
        $scope.loaded = false;
        window.setTimeout(
            callWam,
            0);

    };
    $scope.addonRemove = function (addon) {

        studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
        studio.sendCommand("Addons.removeAddon");
        addon.status = "Install";

    };

    // ------------------------------------------------------------------------
    // > On Change of Project dropdown
    // ------------------------------------------------------------------------

    $scope.changeCurrentProject = function (project) {

        studio.extension.storage.setItem('projectpath', project);

        //console.log('project changed to' + project);
        //console.log('Check all addons');

        checkAddonsStatus();

        //console.log(studio.extension.storage);
        //console.log(project);
    };

    // ---------------------------------------------
    // > OPEN URL IN BROWSER
    // ---------------------------------------------

    $scope.openUrlInBrowser = function (url) {
        window.open(url, '_blank');
    };

    // ------------------------------------------------------------------------
    // > RATING SYSTEM
    // ------------------------------------------------------------------------
    $scope.rateAddon = function (note, addon) {
        //console.log('Yeah ' + note + ' stars for:');
        //console.log(addon);

        // Record score in local addons object
        addon.stars = note;
    };
    // ---------------------------------------------------------------------------------------
    // > custom filter to filter addons while searching just by name , description or owner
    // ---------------------------------------------------------------------------------------


    $scope.addonContainsSearchTerm = function (addon) {
        var txt = $scope.searchTerm.toLowerCase();
        if (($scope.tabNav == "wakanda-extensions") && $scope.onlyInternal)
            return (($scope.searchTerm.length == 0 || addon.name.toLowerCase().indexOf(txt) >= 0 || (addon.description != null && addon.description.toLowerCase().indexOf(txt) >= 0) || (addon.owner != null && addon.owner.toLowerCase().indexOf(txt) >= 0) || (addon.keywords != null && addon.keywords.toLowerCase().indexOf(txt) >= 0)) && addon.type == "wakanda-internal-extensions");
        else
            return ($scope.searchTerm.length == 0 || addon.name.toLowerCase().indexOf(txt) >= 0 || (addon.description != null && addon.description.toLowerCase().indexOf(txt) >= 0) || (addon.owner != null && addon.owner.toLowerCase().indexOf(txt) >= 0) || (addon.keywords != null && addon.keywords.toLowerCase().indexOf(txt) >= 0));
    };

    // ---------------------------------------------
    // > TOOLTIPS
    // ---------------------------------------------
    // $('.tooltip').each(function (index, el) {

    // var elWidth = $(el).width() - 6 ;
    // var btnWidth = $(el).parent().width() + 6;
    // var newLeft =  btnWidth - elWidth ;

    // $(el).css('left', newLeft/2 );
    // });

});

// ------------------------------------------------------------------------
// > ADDONS SERVICE
// ------------------------------------------------------------------------

angular.module('AddonsRest', ['ngResource'])
    .factory('AddonsRest', ['$resource',
        function ($resource) {

            // var version = studio.version.split(' ')[0];
            // var branch = (version == "Dev" || version == "0.0.0.0") ? "master" : "WAK" + version;
            // var branchFilter = "";
            // branch="WAK9";
            // if (branch != "master") {
            // branchFilter = '&$expand=branchs&$filter="branchs.branch="' + branch + '""';
            // }
            return {
                getAddons: $resource('http://addons.wakanda.org/rest/Addons/?&$top=1000&$expand=branchs,dependencies', {}, {
                    get: {
                        method: 'GET',
                        timeout: 10000
                    }
                })
            };

        }
    ]);