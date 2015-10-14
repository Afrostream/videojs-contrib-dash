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
    var rates = this.player().tech['featuresBitrateIndex'];
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
      var selected = this.player().tech['featuresBitrateIndex'];
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
          /* (qualityIndex === player.tech['featuresBitrateIndex']) ||*/ 1;
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
    this.selected(this.player().tech['featuresBitrateIndex'] === this.bitrateIndex);
  };

})(window, window.videojs);

