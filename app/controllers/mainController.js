angular.module('addonsApp')
  .controller('addonsCtrl', function($scope, $timeout, $filter, AddonsService) {
    $scope.updates = 0;
    $scope.addonsManager = AddonsService.manager;

    // Solution Information
    solutionName = studio.currentSolution.getSolutionName();
    solutionFile = studio.currentSolution.getSolutionFile();
    solutionPath = solutionFile !== null ? solutionFile.parent.path : {};
    solutionFilePath = solutionFile !== null ? solutionFile.path : {};

    function getProjects() {
      var projects = [];

      if (studio.currentSolution.getProjects) {
        var currentProjects = studio.currentSolution.getProjects();
        if (currentProjects) {
          projects = currentProjects.map(function(projectName) {
            var waProjectPath = solutionPath + '../' + projectName + '/' + projectName + '.waProject';
            return studio.File(waProjectPath);
          });
        }
      } else {
        // Getting projects from solution XML - WAK10
        solutionXml = studio.loadText(solutionFilePath);
        solutionJson = x2js.xml_str2json(solutionXml);

        angular.forEach(solutionJson.solution.project_asArray, function(value) {
          projects.push(studio.File(solutionPath + value._path));
        });
      }

      return projects;
    }

    $scope.solutionInfos = {
      "solution": {
        "name": solutionName,
        "path": solutionPath,
        "file": {
          "path": solutionFilePath
        },
        "projects": solutionName ? getProjects() : '' // if there is an opened solution
      },
      "studio": {
        "version": studio.version,
        "isEnterprise": studio.isEnterprise || studio.version.isEnterprise
      }
    };

    $scope.solutionInfos.studio.version = utils.getStudioVersionObject($scope.solutionInfos.studio.version, studio.buildNumber);
    $scope.addonsManager.branch = "master";
    if ($scope.solutionInfos.studio.version.major < 1) {
      $scope.addonsManager.branch = "WAK" + $scope.solutionInfos.studio.version.minor;
      $scope.addonsManager.legacy = true;
    }
    $scope.solutionInfos.studio.version.array = [
      parseInt($scope.solutionInfos.studio.version.major),
      parseInt($scope.solutionInfos.studio.version.minor),
      parseInt($scope.solutionInfos.studio.version.patch)
    ];

    studio.extension.storage.setItem('ERROR', '');

    $scope.searchTerm = "";
    $scope.onlyInternal = { value: false };

    // > TABS NAVIGATION (and main filter for the repeater)
    // Tab default if have projects else defaultTab = 'wakanda-extensions'
    if ($scope.solutionInfos.solution.projects.length > 0) {
      $scope.tabNav = studio.extension.storage.getItem('defaultTab');
    } else {
      $scope.tabNav = 'wakanda-extensions';
    }

    // Get category name from tab (wakanda-widgets -> widgets)
    $scope.$watch('tabNav', function(newVal, oldValue) {
      $scope.tabNavName = newVal.replace('wakanda-', '');
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

    function checkUpdates() {
      $scope.updates = 0;
      $scope.addonsManager.addons.forEach(function(addon) {
        if (addon.status === 'Upgrade') {
          $scope.updates++         
        }
      });
    }
    // ------------------------------------------------------------------------
    // > SORT FILTER DEFAULT
    // ------------------------------------------------------------------------
    $scope.sortFilter = studio.extension.storage.getItem('defaultSort');
    $scope.criteria = '';
    $scope.sortOrder = false;

    $scope.$watch('sortFilter', function(criteria) {
      $scope.criteria = criteria;
      if (criteria == "name" || criteria == "owner") {
        $scope.sortOrder = false;
      } else {
        $scope.sortOrder = true;
      }
    });

    // ------------------------------------------------------------------------
    // > ADD CUSTOM REPO
    // ------------------------------------------------------------------------
    $scope.addCustomRepo = function() {
      var repoURL = studio.prompt('Enter the URL of the ' + $scope.tabNavName.substring(0, $scope.tabNavName.length - 1) + '\'s repository to import:', ''),
        brancheName = 'master';

      repoURL = repoURL.trim();

      if (repoURL === '' || repoURL === null || repoURL.length <= 0) {
        return false;
      }

      var params = {};

      repoURL = repoURL.replace(/\/$/, '');

      if (repoURL.match(/\/tree\//)) {
        brancheName = repoURL.substring(repoURL.lastIndexOf('/tree/') + 6, repoURL.length);
        repoURL = repoURL.substring(0, repoURL.lastIndexOf('/tree/'));
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

      var isValid = studio.extension.storage.getItem('ERROR') === 'ok' || studio.extension.storage.getItem('ERROR') === false;
      studio.alert(isValid ? 'The ' + params.name + ' ' + $scope.tabNavName + ' was installed successfully.' : params.name + ' ' + params.type + ' installation failed.');
      if ((studio.extension.storage.getItem('ERROR') === 'ok') && (params.type == "wakanda-extensions"))
        $("#freeow").freeow("Installation Info", studio.extension.storage.getItem('alert'), {
          classes: ["gray", "notice"],
          autoHide: false
        });
      studio.extension.storage.setItem('ERROR', '');
      return false;
    };

    // > GET ALL ADDONS (using AddonsRestService)
    function callWam() {
      $scope.error = false;
      $scope.addonsManager.solutionInfos = $scope.solutionInfos;
      $scope.addonsManager.init().then(function(data) {
        // Stock current tab addons
        // Handle tab change event and refresh addons list
        $scope.$watch('tabNav', function(selectedTab) {
          if (selectedTab == "wakanda-extensions") {
            $scope.addonsManager.addons = $filter('filterWithOr')(data, {
              type: [selectedTab, "wakanda-internal-extensions"]
            });
          } else {
            $scope.addonsManager.addons = $filter('filter')(data, {
              type: $scope.tabNav
            });
          }
          $scope.addonsManager.checkAll();
          checkUpdates();
        });

        $scope.$watch('branch', function() {
          if ($scope.tabNav == "wakanda-extensions") {
            $scope.addonsManager.addons = $filter('filterWithOr')(data, {
              type: [$scope.tabNav, "wakanda-internal-extensions"]
            });
          } else {
            $scope.addonsManager.addons = $filter('filter')(data, {
              type: $scope.tabNav
            });
          }
          $scope.addonsManager.checkAll();
          checkUpdates();
        });
        $scope.loaded = true;
      }).catch(function(err) {
        // Error while accessing addons service
        console.warn(err);
        $scope.error = true;
        $scope.addonsManager.addons = [{
          "name": 'The Add-ons server cannot be reached. You may  <button ng-click="addCustomRepo();" class="button">add your library manually</button> or try again later.'
        }];
      });
      // End Service Call
    }

    callWam();

    // > GENERATE PROJECT DROPDOWN
    $scope.projectsList = [];
    angular.forEach($scope.solutionInfos.solution.projects, function(value) {
      $scope.projectsList.push({
        "nameNoExt": value.nameNoExt,
        "path": value.parent.path,
        "disable": false
      });
    });

    $scope.projectsList = $scope.projectsList.sort(function(a, b) {
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
    $scope.$watch('tabNav', function() {      
      if ($scope.tabNav === 'wakanda-modules' && $scope.currentProject === 'Favorites') {
        $scope.currentProject = $scope.projectsList[0].path;
        studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);
      }
      checkUpdates();
    });

    $scope.reloadTab = function() {
      $scope.loaded = false;
      $timeout(callWam, 0);
      checkUpdates();
    };

    // > On Change of Project dropdown
    $scope.changeCurrentProject = function(project) {
      studio.extension.storage.setItem('projectpath', project);
      $scope.addonsManager.checkAll();
      checkUpdates();
    };

    // > custom filter to filter addons while searching just by name , description or owner
    $scope.addonContainsSearchTerm = function(addon) {
      var txt = $scope.searchTerm.toLowerCase();
      if (($scope.tabNav == "wakanda-extensions") && $scope.onlyInternal.value) {
        return (addon.type === "wakanda-internal-extensions" &&
          ($scope.searchTerm.length === 0 || addon.name.toLowerCase().indexOf(txt) >= 0 ||
          (addon.description !== null && addon.description.toLowerCase().indexOf(txt) >= 0) ||
          (addon.owner !== null && addon.owner.toLowerCase().indexOf(txt) >= 0) ||
          (addon.keywords !== null && addon.keywords.toLowerCase().indexOf(txt) >= 0)));
      } else {
        return ($scope.searchTerm.length === 0 || addon.name.toLowerCase().indexOf(txt) >= 0 || (addon.description !== null && addon.description.toLowerCase().indexOf(txt) >= 0) || (addon.owner !== null && addon.owner.toLowerCase().indexOf(txt) >= 0) || (addon.keywords !== null && addon.keywords.toLowerCase().indexOf(txt) >= 0));
      }
    };

    $scope.getCategoryAddonsCount = function(categoryName) {
      if (!$scope.addonsManager.categories[categoryName]) {
        return 0;
      }
      return Object.keys($scope.addonsManager.categories[categoryName]).length;
    };

  });