var addonsApp = angular.module('addonsApp', ['ngResource', 'AddonsRest', 'angularUtils.directives.dirPagination']);

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
		"solution" : {
			"name" : solutionName,
			"path" : solutionPath,
			"file" : {
				"path" : solutionFilePath
			},
			"projects" : solutionName ? getProjectsFromXML() : '' // if there is an opened solution
		},
		"studio" : {
			"version" : studio.version.split(' ')[0],
			"isEnterprise" : studio.isEnterprise
		}
	};
	$scope.branch = $scope.solutionInfos.studio.version == "Dev" ? "master" : "WAK" + $scope.solutionInfos.studio.version;
	console.group('Solution Infos');
	console.log($scope.solutionInfos);
	console.groupEnd();

	studio.extension.storage.setItem('ERROR', '');

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
			if ($scope.currentProject.path == "Favorites")
				studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);
		}
		if (oldValue == 'wakanda-modules') {
			$scope.projectsList.push({
				"nameNoExt" : '- - - - - - - - - - - - - -',
				"path" : 'line',
				"disable" : true
			}, {
				"nameNoExt" : 'Favorites',
				"path" : 'Favorites',
				"disable" : false
			});

		}
	});

	// ------------------------------------------------------------------------
	// > SORT FILTER DEFAULT
	// ------------------------------------------------------------------------
	$scope.sortFilter = 'updated_at';
	$scope.sortOrder = true;

	// ------------------------------------------------------------------------
	// > ADD CUSTOM REPO
	// ------------------------------------------------------------------------

	$scope.addCustomRepo = function () {

		var repoURL = studio.prompt('Enter the URL of the ' + $scope.tabNavName + ' repository to import:', '');
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

		studio.alert((studio.extension.storage.getItem('ERROR') === 'ok') ? params.name + ' ' + $scope.tabNavName + ' was installed successfully.' : params.name + ' ' + params.type + ' installation failed.');
		console.log(studio.extension.storage.getItem('ERROR'));

		studio.extension.storage.setItem('ERROR', '');

		return false;
	}

	// ------------------------------------------------------------------------
	// > GET ALL ADDONS (using AddonsRest Service)
	// ------------------------------------------------------------------------

	AddonsRest.getAddons.get().$promise.then(function (data) {

		// For each addon add 'license_url' & 'issues_url' if dont exist
		angular.forEach(data.__ENTITIES, function (addon) {

			// Rename fha to hash
			addon.hash = addon.sha;

			// if 'license_urls' doesn't exist, copy github 'HTML_url' in 'license_url'
			// ------------------------------------------------------------------------
			if (!addon.license_url) {
				addon.license_url = addon.html_url;
			}

			// Adding github issues url
			// ------------------------------------------------------------------------
			var issuesArray = addon.html_url.split('/');
			var finalUrl = '';

			for (i = 0; i < 5; i++) {
				finalUrl += issuesArray[i] + '/';
			}

			finalUrl = finalUrl + '/issues/';
			addon.github_issues_url = finalUrl;

			// Adding github githubID
			addon.githubID = issuesArray[3]

		});

		// Stock current tab addons
		$scope.addons = $filter('filter')(data.__ENTITIES, {
				type : $scope.tabNav,
				branch : $scope.branch
			});

		// Handle tab change event and refresh addons list
		$scope.$watch('tabNav', function (selectedTab) {
			$scope.addons = $filter('filter')(data.__ENTITIES, {
					type : selectedTab,
					branch : $scope.branch
				});
			checkAddonsStatus();

		});

		$scope.$watch('branch', function (version) {
			$scope.addons = $filter('filter')(data.__ENTITIES, {
					type : $scope.tabNav,
					branch : version
				});

			checkAddonsStatus();

		});

		// Log
		console.group('All ' + $scope.tabNavName + ' from REST API in the selected tab category');
		console.log($scope.addons.length);
		console.log($scope.addons);
		console.groupEnd();

		// ------------------------------------------------------------------------
		// > GENERATE PROJECT DROPDOWN
		// ------------------------------------------------------------------------

		$scope.projectsList = [];

		angular.forEach($scope.solutionInfos.solution.projects, function (value, key) {

			$scope.projectsList.push({
				"nameNoExt" : value.nameNoExt,
				"path" : value.parent.path,
				"disable" : false
			});
		});

		$scope.projectsList.push({
			"nameNoExt" : '- - - - - - - - - - - - - -',
			"path" : 'line',
			"disable" : true
		}, {
			"nameNoExt" : 'Favorites',
			"path" : 'Favorites',
			"disable" : false
		});

		$scope.currentProject = $scope.projectsList[0];
		studio.extension.storage.setItem('projectpath', $scope.projectsList[0].path);

		// Initial check for installed addons for the default selected project
		checkAddonsStatus();

		// ------------------------------------------------------------------------
		// > On Change of Project dropdown
		// ------------------------------------------------------------------------

		$scope.changeCurrentProject = function (project) {

			studio.extension.storage.setItem('projectpath', project.path);

			console.log('project changed to' + project.path);

			console.log('Check all addons')
			checkAddonsStatus();

			console.log(studio.extension.storage);

			console.log(project);
		}

		// ------------------------------------------------------------------------
		// > RATING SYSTEM
		// ------------------------------------------------------------------------
		$scope.rateAddon = function (note, addon) {
			console.log('Yeah ' + note + ' stars for:');
			console.log(addon);

			// Record score in local addons object
			addon.stars = note;
		}

		// ------------------------------------------------------------------------
		// > BUTTONS ACTIONS
		// ------------------------------------------------------------------------

		$scope.addonInstall = function (addon) {

			studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
			studio.extension.storage.setItem('externals', addon.name);

			studio.sendCommand('Addons.downloadExt');

			studio.sendCommand('Addons.check');

			addon.status = studio.extension.storage.getItem(addon.name);

			if (addon.status == "Installed")
				addon.downloads = addon.downloads + 1;

			studio.extension.storage.setItem('ERROR', '');
		}

		$scope.addonUpgrade = function (addon) {

			studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
			studio.extension.storage.setItem('externals', addon.name);
			studio.sendCommand('Addons.backup');
			studio.sendCommand('Addons.downloadExt');
			studio.sendCommand('Addons.check');

			addon.status = studio.extension.storage.getItem(addon.name);

			if (addon.status == "Installed")
				addon.downloads = addon.downloads + 1;

			studio.extension.storage.setItem('ERROR', '');
		}

		// ------------------------------------------------------------------------
		// > CHECK ADDON STATUS (install, installed, update, ...)
		// ------------------------------------------------------------------------

		function checkAddonsStatus() {

			angular.forEach($scope.addons, function (addon) {

				studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
				studio.sendCommand('Addons.check');
				if (studio.extension.storage.getItem('ERROR') === '' || studio.extension.storage.getItem('ERROR') === 'ok') {

					addon.status = studio.extension.storage.getItem(addon.name);
				} else {
					addon.status = 'reboot';
				}
			});
		}

	}, function (e) {

		// Error while accessing addons service
		console.log('I cant access the addon list :(');

		$scope.addons = [{
				"name" : 'The Add-ons server cannot be reached. You may  <button ng-click="addCustomRepo();" class="button">add your library manually</button> or try again later.'
			}
		];

		console.log($scope.addons);

	});
	// End Service Call


	// ---------------------------------------------
	// > OPEN URL IN BROWSER
	// ---------------------------------------------

	$scope.openUrlInBrowser = function (url) {
		window.open(url, '_blank');
	}

});

// ------------------------------------------------------------------------
// > ADDONS SERVICE
// ------------------------------------------------------------------------

angular.module('AddonsRest', ['ngResource'])
.factory('AddonsRest', ['$resource',
		function ($resource) {

			return {
				getAddons : $resource('http://addons.wakanda.org/rest/Wam/?$top=1000')
			}

		}
	])
.directive('optionsDisabled', function ($parse) {
	var disableOptions = function (scope, attr, element, data, fnDisableIfTrue) {
		// refresh the disabled options in the select element.
		$("option[value!='?']", element).each(function (i, e) {
			var locals = {};
			locals[attr] = data[i];
			$(this).attr("disabled", fnDisableIfTrue(scope, locals));
		});
	};
	return {
		priority : 0,
		require : 'ngModel',
		link : function (scope, iElement, iAttrs, ctrl) {
			// parse expression and build array of disabled options
			var expElements = iAttrs.optionsDisabled.match(/^\s*(.+)\s+for\s+(.+)\s+in\s+(.+)?\s*/);
			var attrToWatch = expElements[3];
			var fnDisableIfTrue = $parse(expElements[1]);
			scope.$watch(attrToWatch, function (newValue, oldValue) {
				if (newValue)
					disableOptions(scope, expElements[2], iElement, newValue, fnDisableIfTrue);
			}, true);
			// handle model updates properly
			scope.$watch(iAttrs.ngModel, function (newValue, oldValue) {
				var disOptions = $parse(attrToWatch)(scope);
				if (newValue)
					disableOptions(scope, expElements[2], iElement, disOptions, fnDisableIfTrue);
			});
		}
	};
});