/*! videojs-contrib-dash - v1.1.1 - 2015-09-28
 * Copyright (c) 2015 Brightcove  */
(function (window, videojs) {
  'use strict';
  /**
   * The component for controlling the playback rate
   *
   * @param {videojs.Player|Object} player
   * @param {Object=} options
   * @constructor
   */
  videojs.BitrateMenuButton = videojs.MenuButton.extend({
    /** @constructor */
    init: function (player, options) {
      videojs.MenuButton.call(this, player, options);

      this.updateVisibility();
      this.updateLabel();

      this.on(player, 'loadstart', this.updateVisibility);
      this.on(player, 'initialized', this.update);
      this.on(player, 'bitratechange', this.updateVisibility);
      this.on(player, 'bitratechange', this.updateLabel);
    }
  });


  videojs.ControlBar.prototype.options_.children.bitrateMenuButton = {};

  videojs.BitrateMenuButton.Labels = ['bas', 'moyen', 'normal', 'HD', 'auto'];
  videojs.BitrateMenuButton.prototype.buttonText = 'Quality Selection';
  videojs.BitrateMenuButton.prototype.className = 'vjs-bitrate';


  videojs.BitrateMenuButton.prototype.createEl = function () {
    var el = videojs.MenuButton.prototype.createEl.call(this);

    this.labelEl_ = videojs.createEl('div', {
      className: 'vjs-bitrate-value',
      innerHTML: 1.0
    });

    el.appendChild(this.labelEl_);

    return el;
  };

// Menu creation
  videojs.BitrateMenuButton.prototype.createMenu = function () {
    if (!this.player().tech) {
      return;
    }
    var menu = new videojs.Menu(this.player());
    var bitRates = this.player().tech['featuresBitrates'];

    if (bitRates) {
      menu.addChild(
        new videojs.BitrateMenuItem(this.player(), {
          qualityIndex: bitRates.length,
          bitrate: 'Auto'
        })
      );
      for (var i = bitRates.length - 1; i >= 0; i--) {
        var bitRate = bitRates[i];
        menu.addChild(
          new videojs.BitrateMenuItem(this.player(), bitRate)
        );
      }
    }

    return menu;
  };

  videojs.BitrateMenuButton.prototype.updateARIAAttributes = function () {
    // Current playback rate
    this.el().setAttribute('aria-valuenow', this.player().tech.getBitrate());
  };

  videojs.BitrateMenuButton.prototype.onClick = function () {
    // select next rate option
    var currentRate = this.player().playbackRate();
    var rates = this.player().tech['featuresBitrate'];
    // this will select first one if the last one currently selected
    var newRate = rates[0];
    for (var i = 0; i < rates.length; i++) {
      if (rates[i] > currentRate) {
        newRate = rates[i];
        break;
      }
    }
    this.player().playbackRate(newRate);
  };

  videojs.BitrateMenuButton.prototype.bitratesSupported = function () {
    return this.player().tech && this.player().tech['featuresBitrates'] &&
      this.player().tech['featuresBitrates'].length > 0;
  };

  /**
   * Hide playback rate controls when they're no playback rate options to select
   */
  videojs.BitrateMenuButton.prototype.updateVisibility = function () {
    if (this.bitratesSupported()) {
      this.removeClass('vjs-hidden');
    } else {
      this.addClass('vjs-hidden');
    }
  };

  /**
   * Update button label when rate changed
   */
  videojs.BitrateMenuButton.prototype.updateLabel = function () {
    if (this.bitratesSupported()) {
      var selected = this.player().tech['featuresBitrate'];
      this.labelEl_.innerHTML = videojs.BitrateMenuButton.Labels[selected];
    }
  };

  /**
   * The specific menu item type for selecting a playback rate
   *
   * @constructor
   */
  videojs.BitrateMenuItem = videojs.MenuItem.extend({
    contentElType: 'button',
    /** @constructor */
    init: function (player, options) {
      var label = this.label =
        parseInt(options['bitrate'], 10) ? options['bitrate'] / 1000 : options['bitrate'];
      var qualityIndex = this.qualityIndex = options['qualityIndex'];
      // Modify options for parent MenuItem class's init.
      options['label'] = videojs.BitrateMenuButton.Labels[qualityIndex] || label;
      options['selected'] =
        (qualityIndex === player.tech['featuresBitrates'].length) ||
          /* (qualityIndex === player.tech['featuresBitrate']) ||*/ 1;
      videojs.MenuItem.call(this, player, options);

      this.on(player, 'bitratechange', this.update);
    }
  });

  videojs.BitrateMenuItem.prototype.onClick = function () {
    videojs.MenuItem.prototype.onClick.call(this);
    //this.player().playbackRate(this.rate);
    this.player().tech.setQuality(this.qualityIndex);
  };

  videojs.BitrateMenuItem.prototype.update = function () {
    this.selected(this.player().tech['featuresBitrate'] === this.bitrateIndex);
  };

})(window, window.videojs);


(function (window, videojs) {
  'use strict';

  var
    isArray = function (a) {
      return Object.prototype.toString.call(a) === '[object Array]';
    },
    isObject = function (a) {
      return Object.prototype.toString.call(a) === '[object Object]';
    },
    mergeOptions = function (obj1, obj2) {
      var key, val1, val2, res;

      // make a copy of obj1 so we're not overwriting original values.
      // like prototype.options_ and all sub options objects
      res = {};

      for (key in obj2) {
        if (obj2.hasOwnProperty(key)) {
          val1 = obj1[key];
          val2 = obj2[key];

          // Check if both properties are pure objects and do a deep merge if so
          if (isObject(val1) && isObject(val2)) {
            obj1[key] = mergeOptions(val1, val2);
          } else {
            obj1[key] = obj2[key];
          }
        }
      }
      return obj1;
    };

  /**
   * videojs-contrib-dash
   *
   * Use Dash.js to playback DASH content inside of Video.js via a SourceHandler
   */
  function Html5DashJS(source, tech) {
    var
      options = tech.options(),
      manifestSource;

    this.tech_ = tech;
    this.el_ = tech.el();
    this.elParent_ = this.el_.parentNode;

    // Do nothing if the src is falsey
    if (!source.src) {
      return;
    }

    // While the manifest is loading and Dash.js has not finished initializing
    // we must defer events and functions calls with isReady_ and then `triggerReady`
    // again later once everything is setup
    tech.isReady_ = false;

    manifestSource = source.src;
    this.keySystemOptions_ = Html5DashJS.buildDashJSProtData(source.keySystemOptions);

    // We have to hide errors since SRC_UNSUPPORTED is thrown by the video element when
    // we set src = '' in order to clear the mediaKeys
    Html5DashJS.hideErrors(this.elParent_);

    // Must be before anything is initialized since we are overridding a global object
    // injection
    if (Html5DashJS.useVideoJSDebug) {
      Html5DashJS.useVideoJSDebug(videojs);
    }

    // Save the context after the first initialization for subsequent instances
    Html5DashJS.context_ = Html5DashJS.context_ || new Dash.di.DashContext();

    // But make a fresh MediaPlayer each time the sourceHandler is used
    this.mediaPlayer_ = new MediaPlayer(Html5DashJS.context_);

    // Must run controller before these two lines or else there is no
    // element to bind to.
    this.mediaPlayer_.startup();
    this.mediaPlayer_.setAutoSwitchQuality(true);
    this.mediaPlayer_.addEventListener(MediaPlayer.events.STREAM_INITIALIZED,
      videojs.bind(this, this.onInitialized));
    this.mediaPlayer_.addEventListener(MediaPlayer.events.STREAM_SWITCH_STARTED,
      videojs.bind(this, this.onStreamSwitchComplete));
    this.mediaPlayer_.addEventListener(MediaPlayer.events.STREAM_SWITCH_COMPLETED,
      videojs.bind(this, this.onStreamSwitchComplete));
    //this.mediaPlayer_.addEventListener(MediaPlayer.events.METRIC_CHANGED,
    //  videojs.bind(this, this.onMetricChanged));
    this.mediaPlayer_.attachView(this.el_);

    // Dash.js autoplays by default
    if (!options.autoplay) {
      this.mediaPlayer_.setAutoPlay(false);
    }

    //this.mediaPlayer_.setAutoSwitchQuality(options.autoSwitch);


    // Fetches and parses the manifest - WARNING the callback is non-standard "error-last" style
    this.mediaPlayer_.retrieveManifest(manifestSource, videojs.bind(this, this.initializeDashJS));

  }

  Html5DashJS.prototype.options_ = {
    autoSwitch: true
  };

  Html5DashJS.prototype.onInitialized = function (manifest, err) {
    if (err) {
      this.player().error(err);
    }
    var bitrates = this.mediaPlayer_.getBitrateInfoListFor('video');
    // bitrates are sorted from lowest to the best values
    // so the last one has the best quality
    //  maxQuality = bitrates[bitrates.length - 1].qualityIndex;
    // set max quality
    this.tech_['featuresBitrates'] = bitrates;
    this.tech_['featuresBitrate'] = bitrates.length; //AUTO;

    videojs.log('Bitrates available:' + bitrates.length);
    //this.mediaPlayer_.setQualityFor('video', maxQuality);
    //TODO generate methods from array
    this.tech_.setQuality = videojs.bind(this, this.setQuality);
    this.tech_.trigger('initialized');
    this.tech_.trigger('bitratechange');
  };

  Html5DashJS.prototype.setQuality = function (qualityIndex) {
    var bitrates = this.mediaPlayer_.getBitrateInfoListFor('video');
    this.mediaPlayer_.setAutoSwitchQuality(qualityIndex >= bitrates.length);
    this.mediaPlayer_.setQualityFor('video', qualityIndex);

    //TODO supprimer ca pour le switch auto
    this.tech_['featuresBitrate'] = qualityIndex; //AUTO;
    this.tech_.trigger('bitratechange');

  };

  Html5DashJS.prototype.getBitrate = function () {
    return this.mediaPlayer_.getBitrateInfoListFor('video');
  };


  Html5DashJS.prototype.getCribbedMetricsFor = function (type) {
    var metrics = this.mediaPlayer_.getMetricsFor(type),
      metricsExt = this.mediaPlayer_.getMetricsExt(),
      repSwitch,
      bufferLevel,
      httpRequests,
      droppedFramesMetrics,
      bitrateIndexValue,
      bandwidthValue,
      pendingValue,
      numBitratesValue,
      bufferLengthValue = 0,
      movingLatency = {},
      movingDownload = {},
      movingRatio = {},
      droppedFramesValue = 0,
      requestsQueue,
      fillmoving = function (type, Requests) {
        var requestWindow,
          downloadTimes,
          latencyTimes,
          durationTimes;

        requestWindow = Requests
          .slice(-20)
          .filter(function (req) {
            return req.responsecode >= 200 && req.responsecode < 300 && !!req.mediaduration && req.type === 'Media Segment' && req.stream === type;
          })
          .slice(-4);
        if (requestWindow.length > 0) {

          latencyTimes = requestWindow.map(function (req) {
            return Math.abs(req.tresponse.getTime() - req.trequest.getTime()) / 1000;
          });

          movingLatency[type] = {
            average: latencyTimes.reduce(function (l, r) {
              return l + r;
            }) / latencyTimes.length,
            high: latencyTimes.reduce(function (l, r) {
              return l < r ? r : l;
            }),
            low: latencyTimes.reduce(function (l, r) {
              return l < r ? l : r;
            }),
            count: latencyTimes.length
          };

          downloadTimes = requestWindow.map(function (req) {
            return Math.abs(req.tfinish.getTime() - req.tresponse.getTime()) / 1000;
          });

          movingDownload[type] = {
            average: downloadTimes.reduce(function (l, r) {
              return l + r;
            }) / downloadTimes.length,
            high: downloadTimes.reduce(function (l, r) {
              return l < r ? r : l;
            }),
            low: downloadTimes.reduce(function (l, r) {
              return l < r ? l : r;
            }),
            count: downloadTimes.length
          };

          durationTimes = requestWindow.map(function (req) {
            return req.mediaduration;
          });

          movingRatio[type] = {
            average: (durationTimes.reduce(function (l, r) {
              return l + r;
            }) / downloadTimes.length) / movingDownload[type].average,
            high: durationTimes.reduce(function (l, r) {
              return l < r ? r : l;
            }) / movingDownload[type].low,
            low: durationTimes.reduce(function (l, r) {
              return l < r ? l : r;
            }) / movingDownload[type].high,
            count: durationTimes.length
          };
        }
      };

    if (metrics && metricsExt) {
      repSwitch = metricsExt.getCurrentRepresentationSwitch(metrics);
      bufferLevel = metricsExt.getCurrentBufferLevel(metrics);
      httpRequests = metricsExt.getHttpRequests(metrics);
      droppedFramesMetrics = metricsExt.getCurrentDroppedFrames(metrics);
      requestsQueue = metricsExt.getRequestsQueue(metrics);

      fillmoving('video', httpRequests);
      fillmoving('audio', httpRequests);

      var streamIdx = this.streamInfo.index;

      if (repSwitch !== null) {
        bitrateIndexValue = metricsExt.getIndexForRepresentation(repSwitch.to, streamIdx);
        bandwidthValue = metricsExt.getBandwidthForRepresentation(repSwitch.to, streamIdx);
        bandwidthValue = bandwidthValue / 1000;
        bandwidthValue = Math.round(bandwidthValue);
      }

      numBitratesValue = metricsExt.getMaxIndexForBufferType(type, streamIdx);

      if (bufferLevel !== null) {
        bufferLengthValue = bufferLevel.level.toPrecision(5);
      }

      if (droppedFramesMetrics !== null) {
        droppedFramesValue = droppedFramesMetrics.droppedFrames;
      }

      if (isNaN(bandwidthValue) || bandwidthValue === undefined) {
        bandwidthValue = 0;
      }

      if (isNaN(bitrateIndexValue) || bitrateIndexValue === undefined) {
        bitrateIndexValue = 0;
      }

      if (isNaN(numBitratesValue) || numBitratesValue === undefined) {
        numBitratesValue = 0;
      }

      if (isNaN(bufferLengthValue) || bufferLengthValue === undefined) {
        bufferLengthValue = 0;
      }

      pendingValue = this.mediaPlayer_.getQualityFor(type);

      return {
        bandwidthValue: bandwidthValue,
        bitrateIndexValue: bitrateIndexValue,
        pendingIndex: (pendingValue !== bitrateIndexValue) ? '(-> ' + (pendingValue) + ')' : '',
        numBitratesValue: numBitratesValue,
        bufferLengthValue: bufferLengthValue,
        droppedFramesValue: droppedFramesValue,
        movingLatency: movingLatency,
        movingDownload: movingDownload,
        movingRatio: movingRatio,
        requestsQueue: requestsQueue
      };
    }
    else {
      return null;
    }
  };


  Html5DashJS.prototype.onMetricChanged = function (e) {
    var metrics;
    // get current buffered ranges of video element and keep them up to date
    if (e.data.stream === 'video') {
      metrics = this.getCribbedMetricsFor('video');
      if (metrics) {
        if (metrics.bitrateIndexValue !== this.tech_['featuresBitrate']) {
          this.tech_['featuresBitrate'] = metrics.bitrateIndexValue;
          this.tech_.trigger('bitratechange');
        }
      }
    }
  };

  Html5DashJS.prototype.onStreamSwitchComplete = function (e) {
    this.tech_['featuresBitrate'] = e.data.toStreamInfo.index;
    this.streamInfo = e.data.toStreamInfo;
    var evt = videojs.fixEvent({
      type: 'bitratechange',
      data: e.data
    });
    this.tech_.trigger(evt);
  };

  Html5DashJS.prototype.initializeDashJS = function (manifest, err) {
    var manifestProtectionData = {};

    if (err) {
      Html5DashJS.showErrors(this.elParent_);
      this.tech_.triggerReady();
      this.dispose();
      return;
    }

    // If we haven't received protection data from the outside world try to get it from the manifest
    // We merge the two allowing the manifest to override any keySystemOptions provided via src()
    if (Html5DashJS.getWidevineProtectionData) {
      manifestProtectionData = Html5DashJS.getWidevineProtectionData(manifest);
      this.keySystemOptions_ = mergeOptions(
        this.keySystemOptions_,
        manifestProtectionData);
    }

    // We have to reset any mediaKeys before the attachSource call below
    this.resetSrc_(videojs.bind(this, function afterMediaKeysReset() {
      Html5DashJS.showErrors(this.elParent_);

      // Attach the source with any protection data
      this.mediaPlayer_.attachSource(manifest, null, this.keySystemOptions_);

      this.tech_.triggerReady();
    }));
  };

  /*
   * Add a css-class that is used to temporarily hide the error dialog while so that
   * we don't see a flash of the dialog box when we remove the video element's src
   * to reset MediaKeys in resetSrc_
   */
  Html5DashJS.hideErrors = function (el) {
    el.className += 'vjs-dashjs-hide-errors';
  };

  /*
   * Remove the css-class above to enable the error dialog to be shown once again
   */
  Html5DashJS.showErrors = function (el) {
    // The video element's src is set asynchronously so we have to wait a while
    // before we unhide any errors
    // 250ms is arbitrary but I haven't seen dash.js take longer than that to initialize
    // in my testing
    setTimeout(function () {
      el.className = el.className.replace('vjs-dashjs-hide-errors', '');
    }, 250);
  };

  /*
   * Iterate over the `keySystemOptions` array and convert each object into
   * the type of object Dash.js expects in the `protData` argument.
   *
   * Also rename 'licenseUrl' property in the options to an 'laURL' property
   */
  Html5DashJS.buildDashJSProtData = function (keySystemOptions) {
    var
      keySystem,
      options,
      i,
      output = {};

    if (!keySystemOptions || !isArray(keySystemOptions)) {
      return output;
    }

    for (i = 0; i < keySystemOptions.length; i++) {
      keySystem = keySystemOptions[i];
      options = mergeOptions({}, keySystem.options);

      if (options.licenseUrl) {
        options.laURL = options.licenseUrl;
        delete options.licenseUrl;
      }

      output[keySystem.name] = options;
    }

    return output;
  };

  /*
   * Helper function to clear any EME keys that may have been set on the video element
   *
   * The MediaKeys has to be explicitly set to null before any DRM content can be loaded into
   * a video element that already contained DRM content.
   */
  Html5DashJS.prototype.resetSrc_ = function (callback) {
    // In Chrome, MediaKeys can NOT be changed when a src is loaded in the video element
    // Dash.js has a bug where it doesn't correctly reset the data so we do it manually
    // The order of these two lines is important. The video element's src must be reset
    // to allow `mediaKeys` to changed otherwise a DOMException is thrown.
    if (this.el_) {
      this.el_.src = '';
      if (this.el_.setMediaKeys) {
        this.el_.setMediaKeys(null).then(callback, callback);
      } else {
        callback();
      }
    }
  };

  Html5DashJS.prototype.dispose = function () {
    if (this.mediaPlayer_) {
      this.mediaPlayer_.reset();
    }
    this.resetSrc_(function noop() {
    });
  };

  // Only add the SourceHandler if the browser supports MediaSourceExtensions
  if (!!window.MediaSource) {
    videojs.Html5.registerSourceHandler({
      canHandleSource: function (source) {
        var dashTypeRE = /^application\/dash\+xml/i;
        var dashExtRE = /\.mpd/i;

        if (dashTypeRE.test(source.type)) {
          return 'probably';
        } else if (dashExtRE.test(source.src)) {
          return 'maybe';
        } else {
          return '';
        }
      },

      handleSource: function (source, tech) {
        return new Html5DashJS(source, tech);
      }
    }, 0);
  }

  videojs.Html5DashJS = Html5DashJS;
})(window, window.videojs);
