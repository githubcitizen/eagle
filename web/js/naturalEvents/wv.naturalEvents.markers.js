var wv = wv || {};
wv.naturalEvents = wv.naturalEvents || {};
wv.naturalEvents.markers = wv.naturalEvents.markers || function(models, maps, config) {

  var self = {},
    boundingBox,
    map;

  map = map || maps.selected;

  self.draw = function(events, dateIndex) {
    if (!events) return null;
    return events.map(function(event){
      var eventItem = event.geometries[dateIndex] || event.geometries[0];
      var coordinates = eventItem.coordinates;
      var hasPolygon = Array.isArray(coordinates[0]);
      if (hasPolygon) {
        boundingBox = createBoundingBox(coordinates);
        map.addLayer(boundingBox);
        return {boundingBox: boundingBox};
      } else {
        pin = createPin(event.id);
        pin.setPosition(coordinates);
        map.addOverlay(pin);
        return {pin: pin};;
      }
    });
  };

  self.remove = function(markers) {
    markers = markers || [];
    if (markers.length<1) return;
    markers.forEach(function(marker){
      if (marker.boundingBox) map.removeLayer(marker.boundingBox);
      if (marker.pin) map.removeLayer(marker.pin);
    });
  };

  return self;
};

var createPin = function(id){
  var pinEl = document.createElement('div');
  pinEl.className = 'map-pin';
  pinEl.appendChild(document.createTextNode(id||'x'));
  return new ol.Overlay({
    element: pinEl
  });
};

var createBoundingBox = function(coordinates){
  return new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [new ol.Feature({
        geometry: new ol.geom.Polygon(coordinates),
        name: 'NaturalEvent'
      })],
      wrapX: false
    }),
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: [255, 255, 255, 0.1]
      }),
      stroke: new ol.style.Stroke({
        color: [212, 85, 0, 0.8],
        width: 2
      })
    })
  });
};
