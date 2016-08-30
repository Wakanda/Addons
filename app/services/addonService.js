angular.module('addonsApp')
  .service('AddonsService', ['AddonsRest', '$timeout', '$q',
    function(AddonsRest, $timeout, $q) {
      var _addonsManager = {
        database: {},
        catalog: {},
        categories: {},
        addons: [],
        branch: 'master',
        legacy: false,
        solutionInfos: {},
        init: function() {
          studio.sendCommand("Addons.retrieveAddons");
          return $q(function(resolve, reject){
            _addonsManager.populate().then(function(result) {
              resolve(result);
            }).catch(function(err) {
              reject(err);
            });
          });
        },
        populate: function() {          
          function elaborateAddonsData(data) {
            data.forEach(function(addon) {
              // populate issues urls - remote only
                if (addon.html_url) {
                var issuesArray = addon.html_url.split('/');
                var finalUrl = '';
                for (i = 0; i < 5; i++) {
                  finalUrl += issuesArray[i] + '/';
                }
                finalUrl = finalUrl + 'issues/';
                addon.github_issues_url = finalUrl;
                // Adding github githubID
                addon.githubID = issuesArray[3];
              }

              if (addon.keywords) {
                var keywordsString = '';
                if (typeof addon.keywords === 'object') {
                  addon.keywords.forEach(function(keyword, i) {
                    if (i > 0) {
                      addon.keywords += ',';
                    }
                    addon.keywords += keyword;
                  });
                } else {
                  addon.keywords = addon.keywords.replace(/","/g, ', ').replace('["', '').replace('"]', '');
                }
              }

              // check if is installed
              addon.isInstalled = _addonsManager.checkInstallation(addon);

              // addons title retro-compatibility
              addon.title = addon.title || addon.name;


            });
            return data;
          }

          function populateAddonCatalog(data) {
            data.forEach(function(addon) {
              // populate categories
              if (!_addonsManager.categories[addon.type]) {
                _addonsManager.categories[addon.type] = {};
              }
              _addonsManager.categories[addon.type][addon.name] = addon;
              // add it to catalog
              _addonsManager.catalog[addon.name] = addon;
            });
            this.addons = data;
          }

          return $q(function(resolve, reject){
            try {
              var localData = AddonsRest.getLocalAddons();
              var remoteData = AddonsRest.getRemoteAddons();
              _addonsManager.database.local = elaborateAddonsData(localData);
              _addonsManager.database.remote = elaborateAddonsData(remoteData);
              populateAddonCatalog(_addonsManager.database.remote);
              resolve(_addonsManager.database.remote);
            } catch(e) {
              reject(e);
            }
          });
        },
        install: function(addon) {
          return $q(function(resolve, reject) {
            if (addon === null || !addon.isCompatible) {
              resolve(false);
            }

            addon.spin = true;
            studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
            studio.extension.storage.setItem('externals', addon.name);
            studio.extension.storage.setItem('alert', false);

            $timeout(function() {
              studio.sendCommand('Addons.downloadExt');
              studio.sendCommand('Addons.checkAddonStatusFromLocalStorage');
              
              addon.spin = false;
              var newStatus = addon.status = studio.extension.storage.getItem(addon.name);
              if (newStatus == "Restart") {
                addon.downloads = addon.downloads + 1;
                addon.restart = true;
              }

              var errorMessage = studio.extension.storage.getItem('ERROR');
              if (errorMessage) {
                reject(errorMessage);
              } else {                
                studio.extension.storage.setItem('ERROR', false);
                addon.dependencies.__ENTITIES.forEach(function (dependency) {
                  var addonId = utils.findItem(_addonsManager.addons, "name", dependency.name);
                  _addonsManager.check(_addonsManager.addons[addonId]);
                });
                studio.sendCommand('Addons.checkUpdates');
                _addonsManager.populate().then(function(result) {
                  resolve(studio.extension.storage.getItem('alert'));
                }).catch(function(err) {
                  reject(err);
                });
              }
            }, 500);
          });
        },
        update: function(addon) {
          return $q(function(resolve, reject) {
            if (!addon.isCompatible) {
              resolve(false);
            }

            addon.spin = true;
            studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
            studio.extension.storage.setItem('externals', addon.name);

            $timeout(function() {
              studio.sendCommand('Addons.downloadExt');
              studio.sendCommand('Addons.checkAddonStatusFromLocalStorage');

              var errorMessage = studio.extension.storage.getItem('ERROR');
              if (errorMessage) {
                reject(errorMessage);
              } else {
                addon.spin = false;
                var newStatus = studio.extension.storage.getItem(addon.name);
                addon.downloads = addon.downloads + 1;
                addon.status = newStatus;
                if (newStatus == "Restart") {
                  addon.restart = true;
                }
                if (addon.dependencies.__ENTITIES) {
                  addon.dependencies.__ENTITIES.forEach(function (dependency) {
                    var addonId = utils.findItem(_addonsManager.addons, "name", dependency.name);
                    _addonsManager.check(_addonsManager.addons[addonId]);
                  });
                }
                studio.sendCommand('Addons.checkUpdates');
                _addonsManager.populate().then(function(result) {
                  resolve(studio.extension.storage.getItem('alert'));
                }).catch(function(err) {
                  reject(err);
                });

              }
            }, 500);
          });
        },
        updateAll: function() {
          var addonsToUpdate = [];

          this.addons.forEach(function(addon) {
            if (addon.status === 'Upgrade') {
              var updateDeferred = function() {
                return $q(function(resolve, reject) {
                  _addonsManager.update(addon).then(function(data) {
                    resolve(data);
                  }).catch(function(err) {
                    reject(err);
                  });
                });
              }
              addonsToUpdate.push(updateDeferred);
            }
          });
          return $q.serial(addonsToUpdate.reverse());
        },
        remove: function(addon) {
          studio.extension.storage.setItem('addonParams', escape(JSON.stringify(addon)));
          studio.sendCommand("Addons.removeAddon");
          addon.status = "Install";
        },
        check: function(addon) {
          switch (addon.status) {
            case 'Install':
              this.install(addon);
              break;
            case 'Upgrade':
              $.confirm({
                'title': 'Upgrade Confirmation',
                'message': 'the ' + addon.name + ' widget already exists in your project. <br />Do you want to override it?',
                'buttons': {
                  'Yes': {
                    'class': 'blue',
                    'action': function() {
                      _addonsManager.update(addon);
                    }
                  },
                  'No': {
                    'class': 'gray',
                    'action': function() {
                      return false;
                    }
                  }
                }
              });
              break;
            default:
              break;
          }
        },
        checkAll: function() {
          // check only active tabs addons, so no widget before opening a solution for example
          this.addons.forEach(function(addon) {
            addon.github_url = addon.html_url.replace(/\/tree\/.*/, "/tree/" + _addonsManager.branch);
            if (!addon.license_url) {
              addon.license_url = addon.github_url;
            }
            studio.extension.storage.setItem('ERROR', false);
            studio.extension.storage.setItem('addonName', addon.name);
            // ask for addon status to index.js
            studio.sendCommand('Addons.checkAddonStatusFromLocalStorage');
          });
          studio.sendCommand('Addons.checkUpdates');
          this.addons.forEach(function(addon) {
            if (!studio.extension.storage.getItem('ERROR')) {
              addon.status = studio.extension.storage.getItem(addon.name);
            } else {
              addon.status = false;
              addon.error = studio.extension.storage.getItem('ERROR');
            }
            if (addon.latestVersion && addon.latestVersion !== addon.version) {
              addon.message = 'An update is available for the latest Wakanda Studio version.';
            }
            if (!addon.isInstalled && !addon.isCompatible) {
              addon.warning = 'This extension is uncompatible with this Wakanda Studio version.';
            }
          });
        },
        checkInstallation: function(addon) {
          var localIndex = utils.findItem(_addonsManager.database.local, "name", addon.name);
          if (localIndex >= 0) {
            return true;
          }
          return false;
        },
        rate: function(vote, addon) {
          addon.stars = vote;
        }
      };

      this.manager = _addonsManager;
      window.addonsManager = this.manager;
    }
  ]);