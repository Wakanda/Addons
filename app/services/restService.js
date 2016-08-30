angular.module('AddonsRest', ['ngResource'])
  .value('AddonsServer', {
    protocol: utils.config.protocol,
    domain: utils.config.domain,
    url: utils.config.url,
    getAddonsUrl: function(params) {
      var paramsString = '?';
      Object.keys(params).forEach(function(paramName) {
        paramsString += '&' + paramName + '=' + params[paramName];
      });
      return this.protocol + '://' + this.domain + this.url + paramsString;
    }
  })
  .factory('AddonsRest', ['$resource', 'AddonsServer',
    function($resource, AddonsServer) {
      var params = {
        '$top': 1000,
        '$expand': 'branchs,dependencies,tags'
      };
      return {
        getLocalAddons: function() {
          var addonsJson = studio.extension.storage.getItem('extensions.local');
          try {
            return JSON.parse(addonsJson);
          } catch(e) {
            studio.log(e);
            return false;
          }
        },
        getRemoteAddons: function() {
          var addonsJson = studio.extension.storage.getItem('extensions.remote');
          try {
            return JSON.parse(addonsJson);
          } catch(e) {
            studio.log(e);
            return false;
          }
        },
        getRestAddons: $resource(AddonsServer.getAddonsUrl(params), {}, {
          get: {
            method: 'GET',
            timeout: 10000
          }
        })
      };
    }
  ]);