angular.module('addonsApp')
  .directive('addon', ['AddonsService', function(AddonsService) {
    return {
      restrict: 'E',
      scope: {
        addon: '='
      },
      link: function(scope, element, attrs) {
        var addonsManager = AddonsService.manager;
        var localAddonIndex = utils.findItem(AddonsService.manager.database.local, "name", scope.addon.name);
        scope.localAddon = (localAddonIndex >= 0) ? addonsManager.database.local[localAddonIndex] : null;
        scope.type = attrs.type;
        scope.splitStrings = function(s, nb) {
          if (!s) {
            return '';
          }
          var array = s.split('<br>');
          var result = array[nb];
          return result;
        };
        scope.openUrlInBrowser = function(url) {
          window.open(url, '_blank');
        };
        scope.getDependencyName = function(dependencyName) {
          if (!addonsManager.catalog[dependencyName]) {
            return dependencyName;
          }
          return addonsManager.catalog[dependencyName].title;
        };
        function noticePopup(options) {
          if (options.message) {
            $("#freeow").freeow("Installation Info", options.message, {
              classes: ["gray", options.type || "notice"],
              autoHide: options.type === "error" ? "false" : "true"
            });
          }
        }
        scope.install = function() {
          addonsManager.install(scope.addon).then(function(installMessage) {
            noticePopup({
              message: installMessage
            });
          }).catch(function(err) {
            noticePopup({
              message: String(err),
              type: "error"
            });
          });
        };
        scope.update = function() {
          addonsManager.update(scope.addon).then(function(updateMessage) {
            noticePopup({
              message: updateMessage
            });
          }).catch(function(err) {
            noticePopup({
              message: String(err),
              type: "error"
            });
          });
        };
        scope.retry = function() {
          addonsManager.retry();
        }; 
        scope.remove = function() {
          addonsManager.remove(scope.addon).then(function(removeMessage) {
            noticePopup({
              message: removeMessage
            });
          }).catch(function(err) {
            noticePopup({
              message: String(err),
              type: "error"
            });
          });
        };
      },
      templateUrl: './app/directives/addon/addonDirective.html'
    }
  }]);