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
wv.map = (function(self) {

  self.CRS_WGS_84 = "EPSG:4326";

  self.CRS_WGS_84_QUERY_EXTENT = [-180, -60, 180, 60];

  /*
   * Checks to see if an extents string is found. If it exist
   * then it is changed from a string to an array which is then
   * made a global object.
   *
   * @method parse
   * @static
   *
   * @param {string} extents string
   *
   * @param {obj} Error
   *
   * @returns {void}
   *
   * @todo would benefit by returning the array instead of attaching it to a global var
   */
  self.parse = function(state, errors) {
    // 1.1 support
    if (state.map) {
      state.v = state.map;
      delete state.map;
    }
    if (state.v) {
      var extent = _.map(state.v.split(","), function(str) {
        return parseFloat(str);
      });
      var valid = wv.map.isExtentValid(extent);
      if (!valid) {
        errors.push({
          message: "Invalid extent: " + state.v
        });
        delete state.v;
      } else {
        state.v = extent;
      }
    }
  };

  /**
   * Determines if an exent object contains valid values.
   *
   * @method isExtentValid
   * @static
   *
   * @param extent {OpenLayers.Bound} The extent to check.
   *
   * @return {boolean} False if any of the values is NaN, otherwise returns
   * true.
   */
  self.isExtentValid = function(extent) {
    if (_.isUndefined(extent)) {
      return false;
    }
    var valid = true;
    if (extent.toArray) {
      extent = extent.toArray();
    }
    _.each(extent, function(value) {
      if (isNaN(value)) {
        valid = false;
        return false;
      }
    });
    return valid;
  };

  /**
   * Scheduler used to render canvas tiles.
   *
   * @attribute TILE_SCHEDULER {Scheduler}
   * @static
   * @readOnly
   */
  self.tileScheduler = _.once(function() {
    if (wv.util.browser.webWorkers) {
      return wv.map.palette.scheduler({
        script: "js/map/wv.map.tileworker.js?v=" + wv.brand.BUILD_NONCE,
        max: 4
      });
    }
  });

  /**
   * Sets the opacity of a layer. Since the backbuffer can interfere with
   * tile layers that have transparency, the transition effect is set to
   * none if the opacity is not equal to one.
   *
   * @method setOpacity
   * @static
   *
   * @param layer {OpenLayers.Layer} The layer to set the opacity
   * @param opacity {float} A value from 0 (transparent) to 1 (opaque).
   */
  self.setOpacity = function(layer, opacity) {
    layer.setOpacity(opacity);
    if (opacity === 1) {
      var effect = layer.originalTransitionEffect || "resize";
      layer.transitionEffect = effect;
    } else {
      layer.originalTransitionEffect = layer.transitionEffect;
      layer.transitionEffect = "none";
    }
  };

  /**
   * Sets the visibility of a layer. If the layer is supposed to be not
   * visible, this actually sets the opacity to zero. This allows the
   * quick transition effects between days.
   *
   * @method setVisibility
   * @static
   *
   * @param layer {OpenLayers.Layer} The layer to set the visibility.
   *
   * @param visible {boolean} True if the layer should be visible, otherwise
   * false.
   *
   * @param opacity {float} The opacity that this layer should be if it
   * is visible. A value from 0 (transparent) to 1 (opaque).
   */
  self.setVisibility = function(layer, visible, opacity) {
    if (layer.isControl) {
      layer.setVisibility(visible);
    } else {
      var actualOpacity = (visible) ? opacity : 0;
      layer.div.style.opacity = actualOpacity;
      if (visible && opacity > 0 && !layer.getVisibility()) {
        layer.setVisibility(true);
      }
    }
  };

  /**
   * Gets the layer object by the name
   *
   * @method getLayerByName
   * @static
   *
   * @param map {object} open layer map object
   *
   * @param name {string} name of layer object to return
   *
   * @return {obj} Layer object
   *
   */
  self.getLayerByName = function(map, name) {
    var layers = map.getLayers()
      .getArray();
    return _.find(layers, {
      "wvname": name
    });
  };

  /**
   * Checks if a polygon's coordinate length is within a set distance
   *
   * @method isPolygonValid
   * @static
   *
   * @param polygon {object} Geometry of a polygon
   *
   * @param maxDistance {number} max length of a polygon
   *
   * @return {boolean}
   *
   * @todo relocate this utility function
   *
   */
  self.isPolygonValid = function(polygon, maxDistance) {
    var outerRing = polygon.getLinearRing(0);
    var points = outerRing.getCoordinates();
    for (var i = 0; i < points.length - 1; i++) {
      var p1 = points[i];
      var p2 = points[i + 1];
      if (Math.abs(p2[0] - p1[0]) > maxDistance) {
        return false;
      }
    }
    return true;
  };

  /**
   * Switches the x coordinate values of Polygon
   * exterior linestring to in the right coordinate value.
   *  -- Reason --
   * when the coordinate of the linestring
   * crosses the antimeridian(180 degrees away from the
   * prime meridian), the value of x  goes from 180 to
   * -180. It needs to be 181.
   *
   * @method adjustAntiMeridian
   * @static
   *
   * @param polygon {object} GeoJSON poylgon geomtry Object
   *
   * @param adjustSign {number} a value of 1 or -1
   *
   * @return {obj} Adjusted GeoJSON poylgon geomtry Object
   *
   * @todo relocate this utility function
   */
  self.adjustAntiMeridian = function(polygon, adjustSign) {
    var outerRing = polygon.getLinearRing(0);
    var points = outerRing.getCoordinates()
      .slice();

    for (var i = 0; i < points.length; i++) {
      if (adjustSign > 0 && points[i][0] < 0) {
        points[i] = [points[i][0] + 360, points[i][1]];
      }
      if (adjustSign < 0 && points[i][0] > 0) {
        points[i] = [points[i][0] - 360, points[i][1]];
      }
    }
    return new ol.geom.Polygon([points]);
  };

  /**
   * Gets distance between two (x,y) points
   *
   * @method distance2D
   * @static
   *
   * @param p1 {number} First Point
   *
   * @param p2 {number} second point
   *
   * @return {number} length of distance
   *
   * @todo relocate this utility function
   *
   */
  self.distance2D = function(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) +
      (Math.pow(p1[1] - p2[1], 2)));
  };

  /**
   * Gets distance between two values on the same axis
   *
   * @method distanceX
   * @static
   *
   * @param p1 {number} First Point
   *
   * @param p1 {number} Second Point
   *
   * @return {number} distance between value one
   *
   * @todo relocate this utility function
   *
   */
  self.distanceX = function(p1, p2) {
    return Math.abs(p2 - p1);
  };

  /**
   * Gets distance between two values on the same axis
   *
   * @method distanceX
   * @static
   *
   * @param p1 {number} First Point
   *
   * @param p1 {number} Second Point
   *
   * @return {number} distance between value one
   *
   * @todo relocate this utility function
   *
   */
  self.interpolate2D = function(p1, p2, amount) {
    var distX = p2[0] - p1[0];
    var distY = p2[1] - p1[1];

    var interpX = p1[0] + (distX * amount);
    var interpY = p1[1] + (distY * amount);

    return [interpX, interpY];
  };

  /**
   * If the geometry has a multipolygon list. This method returns
   * a single multipolygon list object
   *
   * @method toPolys
   * @static
   *
   * @param geom {object} GeoJSON geomtry Object
   *
   * @return {object} GeoJSON multipolygon list object
   *
   * @todo relocate this utility function
   *
   */
  self.toPolys = function(geom) {
    if (geom.getPolygons) {
      return geom.getPolygons();
    }
    return [geom];
  };

  return self;

})(wv.map || {});

/* FIXME OL3
wv.map.mock = function() {

    return {
        setDay: function() {},
        setOpacity: function() {},
        setVisibility: function() {},
        setZIndex: function() {},
        dispose: function() {},
        setLookup: function() {},
        clearLookup: function() {}
    };

};
*/
