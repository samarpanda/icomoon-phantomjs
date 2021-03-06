var page = require('webpage').create(),
    async = require('./async.js'),
    downloadLink;

// Run a check function every 100 ms
function waitFor(checkFn, cb) {
  if (checkFn()) {
    cb();
  } else {
    setTimeout(function waitForFn () {
      waitFor(checkFn, cb);
    }, 100);
  }
}

function openIcoMoon(cb) {
  // Open IcoMoon
  page.open('http://icomoon.io/app', function (status) {
    // If the status was 'fail', callback with an error
    var err = null;
    if (status === 'fail') {
      err = new Error('IcoMoon app "http://icomoon.io/app" could not be opened.');
    }
    cb(err);
  });
}
function waitForLoading(cb) {
  // Wait for loading to complete
  waitFor(function () {
    return page.evaluate(function () {
      return !document.getElementById('loading');
    });
  }, cb);
}

// In series
async.series([
  // On first open, cache bust
  openIcoMoon,
  waitForLoading,
  function clearCache (cb) {
    // Clear out indexedDB and localStorage
    page.evaluate(function () {
      if (window.indexedDB) {
        indexedDB.deleteDatabase('IDBWrapper-storage');
      }

      if (window.localStorage) {
        localStorage.clear();
      }
    });

    // Callback
    cb();
  },
  // Re-open page with busted cache
  openIcoMoon,
  waitForLoading,
  function uploadImages (cb) {
    // Submit many images (need a file path for all our images)
    var fs = require('fs'),
        filesPath = phantom.args[0],
        filesJSON = fs.read(filesPath),
        files = JSON.parse(filesJSON);
    page.uploadFile('#files', files);

    // Continue
    waitFor(function () {
      var itemsCreated = page.evaluate(function () {
        return $('#imported').find('.checkbox-icon').length;
      });
      return itemsCreated === files.length;
    }, cb);
  },
  function moveToDownloadScreen (cb) {
    // Move to the downlod screen
    page.evaluate(function () {
      // Select our images
      $('#imported').find('.checkbox-icon').click();

      // "Click" the 'Next' link
      window.location.hash = 'font';
    });

    // Wait for the next screen to load
    waitFor(function () {
      return page.evaluate(function () {
        return $('#saveFont').length;
      });
    }, cb);
  },
  function exportFont (cb) {
    // Save any zip redirect requests
    page.onNavigationRequested = function (url) {
      if (url.indexOf('.zip') > -1) {
        downloadLink = url;
      }
    };

    // Click the download link
    page.evaluate(function () {
      $('#saveFont').click();
    });

    // Wait for the redirect request to our zip
    waitFor(function () {
      return downloadLink;
    }, cb);
  }
], function output (err) {
  // // DEV: Take a screenshot for progress
  // page.render('app.png');

  // If there was an error, log it
  if (err) {
    console.error(err);
    phantom.exit(1);
  } else {
  // Otherwise, output the download link for the next module
    console.log(downloadLink);
    phantom.exit(0);
  }
});