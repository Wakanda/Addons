/* Copyright (c) 4D, 2014
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * The Software shall be used for Good, not Evil.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 *
 * @namespace Dialog
 */
 
/**
 * Base URL for the add-ons content server.
 * @type {string}
 */

var WAM_BASE = 'http://addons.wakanda.org/rest/Addons/';

var total_items_per_tab;

// var WAM_BASE = 'http://127.0.0.1:8081/rest/Addons/';


studio.extension.storage.setItem('ERROR', '');

/**

 * Event : quit Dialog when pressing ESC key (keyCode=27)

 **/

// window.onkeypress = function (e) {

// if (e.keyCode === 27) {

// studio.extension.quitDialog();

// }

// };


/** remove colse image in windows platform **/

// if (navigator.appVersion.indexOf('Win') != -1) {

// $('.close').hide();

// }

$(function () {

	/**
	 * Event : update tab (header and content ) when clicking
	 **/

	$('.wakRepo li').on('click', function (event) {

		var repoName = this.id;

		window.scrollTo(0, 0);

		event.preventDefault();

		event.stopPropagation();

		updateHeaderContent(repoName);

		$('li.selected').removeClass('selected');

		$(this).addClass('selected');

		getRepoContent(repoName);

	});

	/**
	 * Event : update tab content when changing project
	 **/

	$('#projectsList').on('change', function (e) {

		var optionSelected = $('option:selected', this);

		var valueSelected = this.value;

		studio.extension.storage.setItem('projectpath', valueSelected);

		launchSearch();

	});

	/**
	 * Event : update tab content when searching something  (live search)
	 **/

	$('#searchField').on('keyup', function (event) {

		launchSearch();

	});

	$('#searchField').on('keydown', function (event) {

		launchSearch();

	});

	/** show content **/

	var repoName = studio.extension.storage.getItem('defaultTab');

	if (!studio.currentSolution.getSolutionFile() || !doesSolutionHaveProjects()) {

		removeSolutionTabs();

		repoName = 'wakanda-extensions';

	} else {

		setProjectsList();

	}

	$('#' + repoName).addClass('selected');

	// setItemsNumber(repoName);

	getRepoContent(repoName);

	$('#searchField').data('repoName', repoName);

});

function doesSolutionHaveProjects() {

	var solutionFilePath = studio.currentSolution.getSolutionFile().path;
	var xmltext = studio.loadText(solutionFilePath);
	return xmltext.match(/\<project/);

}

/**

 * @memberof Dialog

 * Gets the text in the search field.

 * Triggers the print of the first page of the repository list found for this type of add-on matching the specified search string.

 */

function launchSearch() {

	window.scrollTo(0, 0);

	var searchString = $('#searchField').val().trim();

	if (searchString.trim().length <= 0) {

		$('.search-form .clear').css('visibility', 'hidden');

	} else {

		$('.search-form .clear').css('visibility', 'visible');

	}

	// setItemsNumber($('#searchField').data('repoName'),searchString);

	getRepoContent($('#searchField').data('repoName'), 1, searchString);

	//$('#searchField').val('');

}

function addCustomRepo() {

	var parentListID = $('li.selected').attr('id');

	var typename = (parentListID.replace('wakanda-', '')).slice(0, -1);

	var repoURL = studio.prompt('Enter the URL of the ' + typename + ' repository to import:', '');

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

	params.type = parentListID;

	params.brancheName = brancheName;

	studio.extension.storage.setItem('addonParams', escape(JSON.stringify(params)));

	studio.extension.storage.setItem('externals', params.name);

	studio.sendCommand('Addons.downloadExt');

	studio.alert((studio.extension.storage.getItem('ERROR') === 'ok') ? params.name + ' ' + typename + ' was installed successfully.' : params.name + ' ' + params.type + ' installation failed.');

	console.log(studio.extension.storage.getItem('ERROR'));

	studio.extension.storage.setItem('ERROR', '');

	return false;

}

/**

 * @memberof Dialog

 * Resets the search field and the repository list for the add-on type.

 */

function clearSearch() {

	window.scrollTo(0, 0);

	event.preventDefault();

	event.stopPropagation();

	$('#searchField').val('');

	// setItemsNumber($('#searchField').data('repoName'));

	getRepoContent($('#searchField').data('repoName'), 1);

	$('.search-form .clear').css('visibility', 'hidden');

}

/*

function getDownloadURL(githubURL) {

var result = githubURL.replace(/https:\/\/api.github.com\/repos\//, '');

console.log(githubURL);



result = result.replace(/git\/trees\//, 'archive/');



return 'https://github.com/' + result + '.zip';

}

 */

/**
 * Extracts the github ID from the URL of a repository.
 * @memberof Dialog
 * @param githubURL
 * @returns {string} The github ID of the repository
 */

function getID(githubURL) {

	return githubURL.substr(githubURL.lastIndexOf('/') + 1);

}

/**
 * @memberof Dialog
 */

function setProjectsList() {

	var solutionFilePath = studio.currentSolution.getSolutionFile().path;

	var solutionPath = studio.currentSolution.getSolutionFile().parent.path;

	var xmltext = studio.loadText(solutionFilePath);

	var xmlDoc = new DOMParser().parseFromString(xmltext, 'text/xml');

	var projects = xmlDoc.getElementsByTagName("project");

	var projectFile,
	i,
	option;

	projectFile = studio.File(solutionPath + projects[0].getAttribute("path"));

	$("#projectsList").append('<option value="' + projectFile.parent.path + '">' + projectFile.nameNoExt + '</option>');

	studio.extension.storage.setItem('projectpath', projectFile.parent.path);

	for (i = 1; i < projects.length; i++) {

		projectFile = studio.File(solutionPath + projects[i].getAttribute("path"));

		$("#projectsList").append('<option value="' + projectFile.parent.path + '">' + projectFile.nameNoExt + '</option>');

	}
	$("#projectsList").append('<option value="line" disabled>&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;</option>');
	$("#projectsList").append('<option value="Favorites">Favorites</option>');

	$('#projectsList').val(studio.extension.storage.getItem('projectpath'));

}

/**
 * Returns the CSS class matching the status of an add-on.
 * @memberof Dialog
 * @param addonStatus {string} Possible values are 'Install', 'Installed', 'Upgrade', 'Restart'. Default value is 'Install'.
 * @returns {string} CSS class
 */

function getCSSPropertiesFromStatus(addonStatus) {

	var cssClass = '';

	switch (addonStatus) {

	case 'Installed':

		cssClass = 'success';

		break;

	case 'Upgrade':

		cssClass = 'update';

		break;

	case 'Restart':

		cssClass = 'reboot';

		break;

	default:

		cssClass = 'install';

		break;

	}

	return cssClass;

}

/**
 * Returns the value of the CSS class to be used for the specified add-on.
 * @memberof Dialog
 * @param addon {object}
 * @returns {string} CSS class
 */

function getButtonStyle(addon) {

	var addonClass = '';

	if (studio.extension.storage.getItem('ERROR') === '') {

		addonClass = getCSSPropertiesFromStatus(studio.extension.storage.getItem(addon.name));

	} else {

		if (studio.extension.storage.getItem('ERROR') === 'ok') {

			addonClass = getCSSPropertiesFromStatus(studio.extension.storage.getItem(addon.name));

		} else {

			addonClass = 'reboot';

		}

	}

	return addonClass;

}

/**
 * Updates the add-on's button after an action has been performed (CSS class & event handlers).
 * @memberof Dialog
 * @param button
 */

function refreshButtonStyle(button) {

	$(button).removeClass();

	var addon = JSON.parse(unescape($(button).data('key')));

	$(button).addClass(getButtonStyle(addon));

	// $(button).attr('disabled',true);

	if ($(button).attr('class') == 'success') {

		$(button).prop('disabled', true);

	}
	if (studio.extension.storage.getItem('ERROR') === 'ok') {

		/// SUCCESS

		//$(button).text(studio.extension.storage.getItem(addon.name));


		$(button).off('click');

	} else {

		/// ERROR

		$(button).addClass('error');

		console.error(studio.extension.storage.getItem('ERROR'));

	}

}

/**
 * Event handler for info buttons.
 * @memberof Dialog
 * @param rootNode
 */

function bindInfoButtons(rootNode) {

	$('.infos', rootNode).on('click', function (event) {

		event.preventDefault();

		event.stopPropagation();

		window.open(JSON.parse(unescape($(this).data('key'))).html_url, '_blank');

	});

}

function bindLicenseButtons(rootNode) {

	$('.license', rootNode).on('click', function (event) {

		event.preventDefault();

		event.stopPropagation();

		if (JSON.parse(unescape($(this).data('key'))).licenseAddress) {

			window.open(JSON.parse(unescape($(this).data('key'))).licenseAddress, '_blank');

		} else {

			window.open(JSON.parse(unescape($(this).data('key'))).html_url, '_blank');

		}

	});

	$('.nalicense', rootNode).prop("disabled", true);

}

/**
 * Event handler for action buttons.
 * @memberof Dialog
 * @param rootNode
 */

function bindInstallButtons(rootNode) {

	$('.install', rootNode).on('click', function (event) {

		$(this).removeClass();

		$(this).addClass('progress');

		// refreshButtonStyle(this);

		// studio.extension.storage.setItem($(this).data('key').name, 'progress');

		// refreshButtonStyle(this);

		event.preventDefault();

		event.stopPropagation();

		studio.extension.storage.setItem('addonParams', $(this).data('key'));

		studio.extension.storage.setItem('externals', getAddonParam('name'));

		studio.sendCommand('Addons.downloadExt');

		studio.sendCommand('Addons.check');

		refreshButtonStyle(this);

		studio.extension.storage.setItem('ERROR', '');

	});

	$('.update', rootNode).on('click', function (event) {

		event.preventDefault();

		event.stopPropagation();

		$(this).removeClass();

		$(this).addClass('progress');

		studio.extension.storage.setItem('addonParams', $(this).data('key'));

		studio.extension.storage.setItem('externals', getAddonParam('name'));

		studio.sendCommand('Addons.backup');

		studio.sendCommand('Addons.downloadExt');

		studio.sendCommand('Addons.check');

		refreshButtonStyle(this);

		studio.extension.storage.setItem('ERROR', '');

	});

	$('.success', rootNode).prop("disabled", true);

}

/**
 * Writes the pagination UI.
 * @memberof Dialog
 * @param repoName {string} Name of the current repository (add-on type).
 * @param pageNumber {number} Current page number.
 * @param maxPages {number} Max page number.
 */

function writePagination(repoName, pageNumber, maxPages) {

	var pagination = $('.pagination'),

	maxLinks = 5;

	var pag = '',

	initialPage;

	if (maxPages <= 1) {

		pagination.html('');

		return;

	}

	if (maxLinks % 2 === 0)
		maxLinks++;

	if (maxPages > maxLinks && pageNumber > 1) {

		initialPage = Math.max(pageNumber - ((maxLinks - 1) / 2), 1);

		if (initialPage + maxLinks > maxPages) {

			initialPage = maxPages - maxLinks + 1;

		}

	} else {

		initialPage = 1;

	}

	for (var i = initialPage; i <= maxPages && i < initialPage + maxLinks; i++) {

		if (i === pageNumber) {

			//pag += '-' + i + '- ';

			pag += '<li><span class="current">' + i + '</span></li>';

		} else {

			pag += '<li><a href="javascript:onClick=getRepoContent(\'' + repoName + '\', ' + i + ', $(\'#searchField\').val())">' + i + '</a></li> ';

		}

	}

	if (pageNumber < maxPages) {

		if (i <= maxPages) {

			pag += '<li><span>...</span></li> ';

		}

		pag += '<li><a href="javascript:onClick=getRepoContent(\'' + repoName + '\', ' + (pageNumber + 1) + ', $(\'#searchField\').val())" class="next"></a></li> ';

	}

	if (pageNumber > 1) {

		if (initialPage > 1) {

			pag = '<li><span>...</span></li> ' + pag;

		}

		pag = '<li><a href="javascript:onClick=getRepoContent(\'' + repoName + '\', ' + (pageNumber - 1) + ', $(\'#searchField\').val())" class="prev"></a></li> ' + pag;

	}

	pagination.html(pag);

}

/**
 * @memberof Dialog
 * @param number
 * @param length
 * @returns {string}
 */

function complementNumber(number, length) {

	length = (length) ? length : 2;

	return (number + Math.pow(10, length) + '').substr(1);

}

/**
 * Formats an ISO date string to the format needed for the UI.
 * @memberof Dialog
 * @param rawDate {string} ISO date.
 * @returns {string} Formatted date.
 */

function formatDate(rawDate) {

	var parsedDate = new Date(Date.parse(rawDate));

	if (!rawDate)
		return '';

	return complementNumber(parsedDate.getMonth() + 1) + '/' + complementNumber(parsedDate.getDate()) + '/' + parsedDate.getFullYear();

}

/**
 * Returns an empty string if a parameter is null.
 * @memberof Dialog
 * @param val {string} Value of the parameter
 * @returns {string}
 */

function stripNullValues(val) {

	return (val) ? val : '';

}

/**
 * Returns the HTML fragment for the specified add-on.
 * @memberof Dialog
 * @param addon {object}
 * @returns {string} HTML fragment.
 */

function getHTMLFragment(addon) {

	var status,
	fragment;

	status = (studio.extension.storage.getItem(addon.name).trim().length > 0) ? studio.extension.storage.getItem(addon.name).trim() : 'Invalid';

	// if (!addon.license) {

		// fragment = '<li> <div class="options"><button class="' + getButtonStyle(addon) + '" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"></button> <button class="nalicense"> N/A </button> <button class="infos" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"></button></div><h2>' + stripNullValues(addon.name) + ' <small>- ' + formatDate(addon.updated_at) + ' <span class="downloadnumber"> ' + addon.downloads + ' downloads &nbsp</span></small> </h2><p>' + stripNullValues(addon.description) + ' <i>- by ' + stripNullValues(addon.owner) + '</i></p></li>';

		// ITEM
		fragment = '<li>';
		fragment += '<div class="studio-ext-addons-infos">';

		// NAME & DATE
		fragment += '<h2>' + stripNullValues(addon.name) + '<span class="date">- ' + formatDate(addon.updated_at) + ' </span>';
		
		// RATING SYSTEM
		fragment += '<span class="rate">';
		fragment += '<span class="colored">★</span>';
		fragment += '<span class="colored">★</span>';
		fragment += '<span class="colored">★</span>';
		fragment += '<span>★</span>';
		fragment += '<span>★</span>';
		fragment += '</span>';

		// DOWNLOAD COUNTER
		fragment += '<span class="downloadnumber">' + addon.downloads + ' downloads</span></h2>';

		// DESCRIPTION & AUTHOR
		fragment += '<p>' + stripNullValues(addon.description) + ' <span class="author">- by ' + stripNullValues(addon.owner) + '</span></p>';
		
		fragment += '</div>';
		fragment += '<div class="options">';

		// MAIN BUTTON (Install / Update / Retry / Installed)
		var mainBtn = {};
		switch ( getButtonStyle(addon) ) {

			case 'success':
				mainBtn.icon = 'fa-check';
				mainBtn.text = 'Installed'
				break;

	
			case 'update':
				mainBtn.icon = 'fa-refresh';
				mainBtn.text = 'Installed'
				break;
	
			case 'reboot':
				mainBtn.icon = 'fa-ban';
				mainBtn.text = 'Installed'
				break;

			default:
				mainBtn.icon = 'fa-download';
				mainBtn.text = 'Install'
				break;
		}

		fragment += '<button class="button ' + getButtonStyle(addon) + '" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"><i class="fa ' + mainBtn.icon + '"></i> ' + mainBtn.text + '</button>';
		
		// LICENSE BUTTON
		if(addon.license){
			fragment += '<button class="button license" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '">' + addon.license + '</button>';
		} else{
			fragment += '<button class="button license" disabled>N/A</button>';
		}
		
		// GITHUB & BUG REPORT BUTTONS
		fragment += '<button class="button github infos" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"><i class="fa fa-github"></i></button>';
		fragment += '<button class="button bug"><i class="fa fa-bug"></i></button>';
		fragment += '</div>';

		fragment += '</li>';


	// } else {

	// 	fragment = '<li> <div class="options"><button class="' + getButtonStyle(addon) + '" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"></button> <button class="license" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '">' + addon.license + '</button> <button class="infos" data-key="' + stripNullValues(escape(JSON.stringify(addon))) + '"></button></div><h2>' + stripNullValues(addon.name) + ' <small>- ' + formatDate(addon.updated_at) + ' <span class="downloadnumber"> ' + addon.downloads + ' downloads &nbsp</span></small> </h2><p>' + stripNullValues(addon.description) + ' <i>- by ' + stripNullValues(addon.owner) + '</i></p></li>';

	// }

	return fragment;

}

/**
 * Gets the contents of the specified repository (add-on type) and displays it on the page.
 * @memberof Dialog
 * @param repoName {string} Name of the repository
 * @param pageNumber {number} Number of the page to display. Default is 1. [optional]
 * @param searchString {string} Search string to filter the results. Default is empty. [optional]
 */

function getRepoContent(repoName, pageNumber, searchString) {

	var i,
	query,
	WAM_url,
	dataObj = {},
	addonsCount = 0,

	itemPerPage = 7;

	if (isNaN(pageNumber) || pageNumber < 1) {

		pageNumber = 1;

	}

	$('#contentList').html('');

	query = 'type = ' + repoName;

	if (searchString && searchString.trim().length > 0) {

		searchString = searchString.trim();

		query += ' AND (name == *' + searchString + '* OR description == *' + searchString + '* OR owner == *' + searchString + '*)';

	}

	WAM_url = WAM_BASE + '?$top=' + itemPerPage + '&$skip=' + ((pageNumber - 1) * itemPerPage) + '&$filter="' + escape(query) + '"&$orderby="priority DESC"';

	$.ajax({

		url : WAM_url,

		dataType : 'json'

	}).done(function (repoContent) {

		var addonsList = repoContent.__ENTITIES;
		var nbItems = repoContent.__COUNT;
		if (searchString && searchString.trim().length > 0) {

			$('#items-found-number').html(" <b>" + nbItems + " " + (repoName.replace('wakanda-', '')).slice(0, -1) + "s found </b> out of " + total_items_per_tab);

		} else {

			$('#items-found-number').html(" <b>" + nbItems + " " + (repoName.replace('wakanda-', '')).slice(0, -1) + "s</b>");

			total_items_per_tab = nbItems;
		}

		var item;
		var fragment = $();
		var fragmentText = '';
		if (addonsList.length > 0) {

			for (i = 0; i < addonsList.length; i++) {

				item = addonsList[i];

				dataObj.ID = item.ID;
				dataObj.name = item.name;
				dataObj.type = item.type;
				dataObj.hash = item.sha;
				dataObj.html_url = item.html_url;
				dataObj.git_url = item.git_url;
				dataObj.owner = item.owner;
				dataObj.description = item.description;
				dataObj.created_at = item.created_at;
				dataObj.updated_at = item.updated_at;
				dataObj.pushed_at = item.pushed_at;
				dataObj.downloads = item.downloads;
				dataObj.githubID = getID(item.git_url);
				dataObj.license = item.license;
				dataObj.licenseAddress = item.licenseAddress;
				studio.extension.storage.setItem('addonParams', escape(JSON.stringify(dataObj)));

				//studio.extension.storage.setItem('pluginName', dataObj.name);
				//studio.extension.storage.setItem('pluginType', dataObj.type);
				//studio.extension.storage.setItem('pluginHash', dataObj.hash);

				studio.sendCommand('Addons.check');

				fragmentText += getHTMLFragment(dataObj);

				if (studio.extension.storage.getItem('ERROR') !== '') {

					//studio.extension.storage.setItem('alertMessage', studio.extension.storage.getItem('ERROR'));
					//studio.sendCommand('Addons.alert');
					studio.extension.storage.setItem('ERROR', '');
				}

				addonsCount++;

			}

		} else {

			fragmentText += '<p align=\'center\'>No results found.</p>';

		}

		writePagination(repoName, pageNumber, Math.ceil(nbItems / itemPerPage));

		fragment = fragment.add(fragmentText);

		bindInstallButtons(fragment);

		bindInfoButtons(fragment);

		bindLicenseButtons(fragment);

		$('#contentList').html(fragment);

		addHoverEvent();

		// if (repoName != 'wakanda-extensions') {

		// setProjectsList();


		// $('#projectsList').val(studio.extension.storage.getItem('projectpath'));


		// }

	})

	.fail(function () {

		$('#contentList').html('<br><p align=\'center\'>The Add-ons server cannot be reached. You may  <button onclick="addCustomRepo();" style="font-size: 1.5rem;line-height: 2rem;">add your library manually</button> or try again later.</p>');

	});

}

// function setItemsNumber(repoName, searchString){

// var query,WAM_url;

// query = 'type = ' + repoName;

// if (searchString && searchString.trim().length > 0) {

// searchString = searchString.trim();

// query += ' AND (name == *' + searchString + '* OR description == *' + searchString + '* OR owner == *' + searchString + '*)';
// }


// WAM_url = WAM_BASE +'?$filter="' + escape(query) + '"';

// $.ajax({

// url: WAM_url,

// dataType: 'json',

// success: function (repoContent) {
// if (searchString && searchString.trim().length > 0){


// $('#items-found-number').html(" <b>"+repoContent.__ENTITIES.length+" "+(repoName.replace('wakanda-','')).slice(0,-1)+"s found </b> out of "+total_items_per_tab);

// }  else {

// $('#items-found-number').html(" <b>"+repoContent.__ENTITIES.length+" "+(repoName.replace('wakanda-','')).slice(0,-1)+"s</b>");

// total_items_per_tab=repoContent.__ENTITIES.length;
// }
// },
// error: function () {

// }

// });

// }

function updateHeaderContent(repoName) {

	var addonsType = (repoName.replace('wakanda-', '')).slice(0, -1);

	$('#searchField').val('');

	$('.search-form .clear').css('visibility', 'hidden');

	$('#searchField').data('repoName', repoName);

	// setItemsNumber(repoName);

	if (addonsType == 'extension') {

		$('#ps').css('visibility', 'visible');

		$('#selecting').removeClass();

		$('#selecting').addClass('projectselectdisabled');

		$('#addRepo').text('Import an ' + addonsType);

	} else {

		$('#ps').css('visibility', 'hidden');

		$('#selecting').removeClass();

		$('#selecting').addClass('projectselect');

		$('#addRepo').text('Import a ' + addonsType);
		if ((addonsType != 'theme') && (addonsType != 'widget')) {
			$("#projectsList option[value='Favorites']").remove();
			$("#projectsList option[value='line']").remove();
		}
		if (addonsType != 'module') {
			if ($("#projectsList option[value='Favorites']").length == 0) {
				$("#projectsList").append('<option value="line" disabled>&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;</option>');
				$("#projectsList").append('<option value="Favorites">Favorites</option>');
			}
		}

	}

}

function removeSolutionTabs() {

	$('#wakanda-widgets').remove();

	$('#wakanda-themes').remove();

	$('#wakanda-modules').remove();

	$('#wakanda-extensions').addClass('selected');

	$('#ps').css('visibility', 'visible');

	$('#addRepo').text('Import an extension');

	$('#selecting').removeClass();

	$('#selecting').addClass('projectselectdisabled');

}

function addHoverEvent() {

	// $('#contentList li').hover(function () {

	// $(this).css("background-color", "#fdfdfd");

	// }, function () {

	// $(this).css("background-color", "#f2f2f2");

	// });

	// $('.infos').hover(function (event) {

	// 	$('<span class="tooltip"></span>').text("View on GitHub")
	// 	.appendTo('#contentList li')
	// 	.css('top', ($(this).position().top - 25) + 'px')
	// 	.css('left', ($(this).position().left + 13) + 'px')
	// 	.fadeIn('slow');
	// }, function () {
	// 	$('.tooltip').remove();
	// });

}

function getAddonParam(paramName) {

	var addonParams = JSON.parse(unescape(studio.extension.storage.getItem('addonParams')));

	return addonParams[paramName];

}