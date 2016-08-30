angular.module('addonsApp', ['ngResource', 'AddonsRest', 'angularUtils.directives.dirPagination'])
  .config(function(paginationTemplateProvider, $provide) {
    paginationTemplateProvider.setPath('./app/directives/pagination/dirPagination.html');
    $provide.decorator("$q", function ($delegate) {
      var isPromiseLike = function (obj) { return obj && angular.isFunction(obj.then); }
      function serial(tasks) {
        var prevPromise;
        var error = new Error();
        angular.forEach(tasks, function (task, key) {
          var success = task.success || task;
          var fail = task.fail;
          var notify = task.notify;
          var nextPromise;
          if (!prevPromise) {
            nextPromise = success();
            if (!isPromiseLike(nextPromise)) {
              error.message = "Task " + key + " did not return a promise.";
              throw error;
            }
          } else {
            nextPromise = prevPromise.then(
              function (data) {
                if (!success) { return data; }
                var ret = success(data);
                if (!isPromiseLike(ret)) {
                  error.message = "Task " + key + " did not return a promise.";
                  throw error;
                }
                return ret;
              },
              function (reason) {
                if (!fail) { return $delegate.reject(reason); }
                var ret = fail(reason);
                if (!isPromiseLike(ret)) {
                  error.message = "Fail for task " + key + " did not return a promise.";
                  throw error;
                }
                return ret;
              },
              notify);
          }
          prevPromise = nextPromise;
        });
        return prevPromise || $delegate.when();
      }
      $delegate.serial = serial;
      return $delegate;
    });
  })
  .filter('filterWithOr', function($filter) {
    var comparator = function(actualFilter, expectedFilter) {
      var actual = actualFilter,
        expected = expectedFilter;

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
        expected.forEach(function(e) {

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
    return function(array, expression) {
      return $filter('filter')(array, expression, comparator);
    };
  });