/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "2d9b388b48d754340f33c85a36a6ddb4"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2d8b0e397c6ed7f080d5fda1f6d3d887"
  }, {
    "url": "pwa-192x192.png",
    "revision": "657a2be823f40c7ed3606ece4f59ebb6"
  }, {
    "url": "index.html",
    "revision": "701cf731b980f3a7778a254fae276821"
  }, {
    "url": "favicon.ico",
    "revision": "cf562420dda2f807ef35523fd02d27b9"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "d17876dabaa8c0713d1c2a97385cabf5"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-Dv522pZC.js",
    "revision": null
  }, {
    "url": "assets/index-D_7jtk8f.js",
    "revision": null
  }, {
    "url": "assets/index-CXCarsL0.css",
    "revision": null
  }, {
    "url": "assets/aistudio/download_7eb2aac4.jpeg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "d17876dabaa8c0713d1c2a97385cabf5"
  }, {
    "url": "favicon.ico",
    "revision": "cf562420dda2f807ef35523fd02d27b9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "657a2be823f40c7ed3606ece4f59ebb6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2d8b0e397c6ed7f080d5fda1f6d3d887"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2d9b388b48d754340f33c85a36a6ddb4"
  }, {
    "url": "assets/aistudio/download_7eb2aac4.jpeg",
    "revision": "49af5168b62b14ad6e7357ab50f9c440"
  }, {
    "url": "manifest.webmanifest",
    "revision": "9f90aff5e2566a39297a7a3bae99640d"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/api\.dicebear\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "avatar-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
