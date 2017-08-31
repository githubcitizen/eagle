/*
 * NASA Worldview
 *
 * This code was originally developed at NASA/Goddard Space Flight Center for
 * the Earth Science Data and Information System (ESDIS) project.
 *
 * Copyright (C) 2013 - 2014 United States Government as represented by the
 * Administrator of the National Aeronautics and Space Administration.
 * All Rights Reserved.
 */
var wv = wv || {};
wv.map = wv.map || {};

/*
 * @Class
 */
wv.map.animate = wv.map.animate || function(models, config, ui) {

  var model = models.map;
  var self = {};

  var lastLocation;

  var init = function() {

  };

  /**
   * Moves the map with a "flying" animation
   *
   * @param  {Array} endPoint  Ending coordinates
   * @param  {integer} endZoom Ending Zoom Level
   */
  self.fly = function(endPoint, endZoom) {
    var view = ui.map.selected.getView();
    view.cancelAnimations();
    var startPoint = view.getCenter();
    var startZoom = Math.floor(view.getZoom());
    endZoom = endZoom || 5;
    if (endPoint.length > 2) endPoint = ol.extent.getCenter(endPoint);
    var extent = view.calculateExtent();
    var projection = view.getProjection();
    var hasEndInView = ol.extent.containsCoordinate(extent, endPoint);
    var line = new ol.geom.LineString([startPoint, endPoint]);
    var distance = line.getLength();
    var duration = (distance * 20)+1000; // 4.6 seconds to go around earth
    var zoomOut = endZoom;
    var zoomDifference = Math.abs(startZoom-endZoom);
    if (zoomDifference > 2 || !hasEndInView) {
      zoomOut = getBestZoom(distance, startZoom, endZoom, view);
    }
    Promise.all([
      view.animate({center: endPoint, duration: duration}),
      view.animate(
        {zoom: zoomOut, duration: duration/2},
        {zoom: endZoom, duration: duration/2}
      )
    ]);
  };

  /**
   * Gets the best zoom level for the middle of the flight animation
   *
   * @param  {integer} distance distance of the animation in map units
   * @param  {integer} start    starting zoom level
   * @param  {integer} end      ending zoom level
   * @param  {object} view     map view
   * @return {integer}          best zoom level for flight animation
   */
  var getBestZoom = function(distance, start, end, view) {
    var idealLength = 1500;
    var lines = [2,3,4,5,6,7,8].map(function(zoom){
      return {
        zoom: zoom,
        pixels: distance/view.getResolutionForZoom(zoom)
      };
    });
    var bestFit = lines.sort(function(a, b) {
      return Math.abs(idealLength - a.pixels) - Math.abs(idealLength - b.pixels);
    })[0];
    return Math.max(2, Math.min(bestFit.zoom, start-1, end-1));
  };

  /*
   * Zooms in to next event location
   *
   * @method zoom
   * @private
   *
   * @param {object} view - OL view Object
   * @param {number} duration - time of map animation
   * @param {Object} newZoom - Zoom level at the end of animation
   *
   * @returns {void}
   */
  var zoom = function(view, duration, newZoom) {
    view.animate({
      duration: duration,
      zoom: newZoom,
    });
  };
  /*
   * A method that zooms of a current zoom level and then
   *  back down into the zoom level of the next event
   *
   * @method bouce
   * @private
   *
   * @param {object} view - OL view Object
   * @param {number} duration - time of map animation
   * @param {array} bounceZoom - Outmost zoom level of animation
   * @param {Object} newZoom - Zoom level at the end of animation
   *
   * @returns {void}
   */
  var bounce = function(view, duration, bounceZoom, newZoom) {
    view.animate({
      zoom: bounceZoom,
      duration: duration / 2
    }, {
      zoom: newZoom,
      duration: duration / 2
    });
  };

  /*
   * Animates in direction of new coordinates
   *
   * @method fly
   * @private
   *
   * @param {object} view - OL view Object
   * @param {number} duration - time of map animation
   * @param {array} location - Coordinates of Event
   *
   * @returns {void}
   */
  var fly = function(view, duration, location) {
    view.animate({
      duration: duration,
      center: location
    });
  };

  init();
  return self;

};
