var wv = wv || {};
wv.naturalEvents = wv.naturalEvents || {};

wv.naturalEvents.ui = wv.naturalEvents.ui || function(models, ui, config, request) {

  var self = {};
  var model = models.naturalEvents;
  var data;
  self.selector = "#wv-events";
  self.id = "wv-events";
  self.markers = [];
  self.selected = {};
  var naturalEventMarkers = wv.naturalEvents.markers(models, ui, config);

  var notified = false;
  var lastId = false;
  var lastDate = false;

  var $notification;

  var init = function() {
    request.events.on("queryResults", onQueryResults);
    ui.sidebar.events.on("select", function(tab) {
      if (tab === "events") {
        naturalEventMarkers.remove(self.markers);
        self.markers = naturalEventMarkers.draw(data);
        model.active = true;
        resize();
        if (self.selected.id) {
          self.select(self.selected.id, self.selected.date||null);
        }
      } else {
        model.active = false;
        naturalEventMarkers.remove(self.markers);
        $notification.dialog('close');
      }
      model.events.trigger('change');
    });
    $(window)
      .resize(resize);
    render();

  };
  var onQueryResults = function() {
    //FIXME: this if check needs to be reworked
    if (model.data.sources) {
      data = model.data.events;
      self.refresh();
    }
  };
  var render = function() {
    var $panels = $(self.selector)
      .empty()
      .addClass(self.id + "list")
      .addClass("bank");

    var $list = $("<ul></ul>")
      .attr("id", self.id + "content")
      .addClass("content")
      .addClass("map-item-list");

    $panels.append($list);

    var $detailContainer = $("<div></div>")
      .attr("id", "wv-events-detail")
      .hide();

    $panels.append($detailContainer);

    //******************************************
    //TODO: This should be moved to wv.ui.notify
    var $message = $('<span></span>')
      .addClass('notify-message');

    var $icon = $('<i></i>')
      .addClass('fa fa-warning fa-1x');

    var $messageWrapper = $('<div></div>')
      .click(function() {
        showNotificationHelp();
      });

    $messageWrapper
      .append($icon)
      .append($message);

    var $close = $('<i></i>')
      .addClass('fa fa-times fa-1x')
      .click(function() {
        $notification.dialog('close');
      });

    $notification = $('<div></div>')
      .append($close)
      .append($messageWrapper)
      .dialog({
        autoOpen: false,
        resizable: false,
        height: 40,
        width: 420,
        draggable: false,
        show: {
          effect: "fade",
          duration: 400
        },
        hide: {
          effect: "fade",
          duration: 200
        },
        dialogClass: 'no-titlebar notify-alert',
        close: function() {
          notified = true;
        }
      });
    //**************************************

  };
  var showNotificationHelp = function() {
    var headerMsg = "<h3 class='wv-data-unavailable-header'>Why can’t I see an event?</h3>";
    var bodyMsg = 'There are a variety of factors as to why you may not be seeing an event in Worldview at the moment.' +
      '<ul>' +
      '<li>Satellite overpass may have occurred before the event. Check out subsequent days or try a different satellite/sensor which has a different overpass time.</li>' +
      '<li>Cloud cover may obscure the event.</li>' +
      '<li>Some events don’t appear on the day that they are reported, you may have to wait a day or two for an event to become visible. Try and scroll through the days to see an event’s progression and/or change the satellite/sensor. NOTE: Wildfire events are currently set to automatically display the next day, as fire events often do not appear in the satellite imagery on the day they are reported.</li>' +
      '<li>The resolution of the imagery may be too coarse to see an event.</li>' +
      '<li>There are normal swath data gaps in some of the imagery layers due to way the satellite orbits the Earth, and an event may have occurred in the data gap.</li>' +
      '</ul>' +
      'This is currently an experimental feature and we are working closely with the provider of these events, the <a href="http://eonet.sci.gsfc.nasa.gov/" target="_blank">Earth Observatory Natural Event Tracker</a>, to refine this listing to only show events that are visible with our satellite imagery.';

    wv.ui.notify(headerMsg + bodyMsg, "Notice", 800);
  };

  self.refresh = function() {
    var $content = $(self.selector + "content");

    $content = $(self.selector + "content")
      .empty();
    // iterate through events
    _.each(data, function(event) {
      refreshEvent($content, event);
    });

    // Bind click event to each event
    var $current;
    $(self.selector + "content li")
      .toggle(function() {
        if ($current) {
          $current.click();
        }
        var dataId = $(this)
          .attr("data-id");
        if ($(this)
          .find("ul li.dates a")
          .first()
          .hasClass("date-today")) {
          var nextDate = $(self.selector + "content ul li.dates")
            .next()
            .children("a")
            .attr("data-date");
          showEvent(dataId, nextDate);
        } else {
          showEvent(dataId);
        }
        $(self.selector + "content li")
          .removeClass('item-selected');
        $(self.selector + "content ul li.dates a")
          .removeClass('active');
        $(this)
          .addClass('item-selected');
        if (wv.util.browser.small) {
          ui.sidebar.collapseNow();
        }
        notify();
        $current = $(this);
      }, function() {
        $(self.selector + "content li")
          .removeClass('item-selected');
        $(self.selector + "content ul li.dates a")
          .removeClass('active');
        hideEvent();
        naturalEventMarkers.remove(self.markers);
        $current = null;
      });

    $(self.selector + "content li")
      .click(function() {
        $(this)
          .find("ul li.dates a.date")
          .first()
          .addClass('active');
      });

    //Bind click event to each date contained in events with dates
    $(self.selector + "content ul li.dates a")
      .click(function(event) {
        event.stopPropagation();
        var dataId = $(this)
          .attr("data-id");
        showEvent(dataId, $(this)
          .attr("data-date"));
        $(self.selector + "content ul li.dates a")
          .not(this)
          .removeClass('active');
        $(this)
          .addClass('active');
      });

    resize();
  };

  self.select = function(id, date) {
    var eventCategory, geometry, method, zoomCenter, zoomLevel;
    var hasSameId = id === lastId;
    var hasSameDate = lastDate === date;
    lastId = id;
    lastDate = date;
    // Store selected id and date in model
    self.selected = {id: id};
    if (date) self.selected.date = date;

    // Set the correct map projection
    if (models.proj.selected.id !== 'geographic') {
      models.proj.select('geographic');
    }

    var event = _.find(model.data.events, function(e){
      return e.id === id;
    });

    // Get event geometry and category
    var geometry;
    if (date) {
      geometry = _.find(event.geometries, function(geom){
        return geom.date.split('T')[0] === date;
      });
    } else {
      geometry = event.geometries[0];
    }

    eventCategory = (Array.isArray(event.categories)
      ? event.categories[0]
      : event.categories||'Default').title;

    // Turn on the relevant layers for the event type
    layers = model.layers[eventCategory];
    if (!layers) layers = model.layers.Default;
    // Turn off all layers in list first
    _.each(models.layers.active, function(layer) {
      models.layers.setVisibility(layer.id, false);
    });
    // Turn on or add new layers
    _.each(layers, function(layer) {
      var id = layer[0];
      var visible = layer[1];
      if (models.layers.exists(id)) {
        models.layers.setVisibility(id, visible);
      } else {
        models.layers.add(id, {
          visible: visible
        });
      }
    });

    // Turn on the right markers, and store references in the model
    naturalEventMarkers.remove(self.markers);
    self.markers = naturalEventMarkers.draw([event], date);

    // Animate to the right place on the map
    geometryDate = wv.util.parseTimestampUTC(geometry.date);
    var geometryISO = wv.util.toISOStringDate(geometryDate);
    var todayISO = wv.util.toISOStringDate(wv.util.today());
    var isToday = geometryISO === todayISO;
    var isWildfire = eventCategory === 'Wildfires';
    var isVolcano = eventCategory === 'Volcanoes';
    /* If an event is a Wildfire and the event date isn't "today", select
    the following day to greatly improve the chance of the satellite
    seeing the event. NOTE: there is a risk that if the fire happened "yesterday" and
    the satellite imagery is not yet available for "today", this
    functionality may do more harm than good. */
    if (isWildfire && !isToday) {
      var geometryDatePlusOne =
        wv.util.dateAdd(wv.util.parseDateUTC(geometry.date), "day", 1);
      models.date.select(geometryDatePlusOne);
    } else {
      models.date.select(geometryDate);
    }
    // If an event is a Wildfire or Volcano, zoom in more
    zoomLevel = isWildfire?8:isVolcano?6:5;
    method = (hasSameId && !hasSameDate)?'pan':'fly';
    // Determine where to zoom to
    if (geometry.type === 'Polygon') {
      zoomCenter = ol.extent.boundingExtent(geometry.coordinates[0]);
    } else {
      zoomCenter = geometry.coordinates;
    }
    ui.map.animate.move(method, zoomCenter, zoomLevel);

  };

  var refreshEvent = function($content, event) {
    var eventCategoryID = event.categories[0].id || null;
    // Sort by latest dates first
    var geoms = toArray(event.geometries)
      .reverse();

    eventDate = wv.util.parseDateUTC(geoms[0].date);

    dateString = wv.util.giveWeekDay(eventDate) + ", " +
      wv.util.giveMonth(eventDate) + " " +
      eventDate.getUTCDate();

    if (eventDate.getUTCFullYear() !== wv.util.today()
      .getUTCFullYear()) {
      dateString += ", " + eventDate.getUTCFullYear();
    }

    var $item = $("<li></li>")
      .addClass("selectorItem")
      .addClass("item")
      .addClass(event.categories[0].slug)
      .attr("data-id", event.id);
    var $title = $("<h4></h4>")
      .addClass("title")
      .html(event.title + "<br/>" + dateString);
    var $subtitle = $("<p></p>")
      .addClass("subtitle")
      .html(event.description)
      .hide();
    var $mapMarker = $("<i></i>")
      .addClass('map-marker')
      .attr('title', event.categories[0].title);

    var $dates = $("<ul></ul>")
      .addClass("dates")
      .hide();

    if (event.geometries.length > 1) {
      var lastDate;
      var eventIndex = 0;
      _.each(event.geometries, function(geometry) {
        eventIndex++;
        date = geometry.date.split('T')[0];
        var todayDateISOString = wv.util.toISOStringDate(wv.util.today());

        if (date === lastDate) return;

        $date = $("<a></a>")
          .addClass("date")
          .attr("data-date", date)
          .attr("data-id", event.id)
          .html(date);

        // Check first multi-day event
        if (eventIndex == 1) {
          // If it's date is today and it is a Severe Storm, mark it
          // and don't make it active.
          if ((date === todayDateISOString) && (eventCategoryID == 10)) {
            $date.removeClass("date")
              .addClass("date-today");
          } else {
            $date.addClass("active");
          }
        }
        $dates.append($("<li class='dates'></li>")
          .append($date));
        lastDate = date;
      });
    }

    $item.append($mapMarker)
      .append($title)
      .append($subtitle)
      .append($dates);
    var references = toArray(event.sources);
    if (references.length > 0) {
      items = [];
      _.each(references, function(reference) {
        var source = _.find(model.data.sources, {
          id: reference.id
        });
        if (reference.url) {
          items.push("<a target='event' class='natural-event-link' href='" + reference.url + "'>" +
            "<i class='fa fa-external-link fa-1'></i>" +
            source.title + "</a>");
        } else {
          items.push(source.title);
        }
      });
      $subtitle.append(items.join(" "));
    }

    $content.append($item);
    $('.natural-event-link')
      .click(function(e) {
        e.stopPropagation();
      });
  };

  var showEvent = function(id, date) {

    self.select(id, date);
    $("#wv-eventscontent .subtitle")
      .hide();
    $("#wv-eventscontent .dates")
      .hide();
    $("#wv-eventscontent [data-id='" + id + "'] .subtitle")
      .show();
    $("#wv-eventscontent [data-id='" + id + "'] .dates")
      .show();
    resize();

  };
  var hideEvent = function() {
    $("#wv-eventscontent .subtitle")
      .hide();
    $("#wv-eventscontent .dates")
      .hide();
    resize();
  };
  var notify = function(text) {

    var message = text || 'Events may not be visible at all times.  Read more...';

    var $message = $('.notify-message');

    $message.empty();
    $message.append(message);

    $notification.find('i:first-child')
      .attr('title', message);

    if (!notified) {
      $notification.dialog('open');
    }
  };

  //TODO: Move to wv.ui.sidebar
  var productsIsOverflow = false;
  var sizeEventsTab = function() {
    var winSize = $(window)
      .outerHeight(true);
    var headSize = $("ul#productsHolder-tabs")
      .outerHeight(true);
    var head2Size = $('#wv-events-facets')
      .outerHeight(true);
    var secSize = $("#productsHolder")
      .innerHeight() - $("#productsHolder")
        .height();
    var offset = $("#productsHolder")
      .offset();
    var timeSize = $("#timeline")
      .outerHeight(true);

    //FIXME: -10 here is the timeline's bottom position from page, fix
    // after timeline markup is corrected to be loaded first
    var maxHeight = winSize - headSize - head2Size -
      offset.top - secSize;
    if (!wv.util.browser.small) {
      maxHeight = maxHeight - timeSize - 10 - 5;
    }
    $(self.selector)
      .css("max-height", maxHeight);

    var childrenHeight =
      $('#wv-eventscontent')
        .outerHeight(true);

    if ((maxHeight <= childrenHeight)) {
      $("#wv-events")
        .css('height', maxHeight)
        .css('padding-right', '10px');
      if (productsIsOverflow) {
        $(self.selector)
          .perfectScrollbar('update');
      } else {
        $(self.selector)
          .perfectScrollbar();
        productsIsOverflow = true;
      }
    } else {
      $("#wv-events")
        .css('height', '')
        .css('padding-right', '');
      if (productsIsOverflow) {
        $(self.selector)
          .perfectScrollbar('destroy');
        productsIsOverflow = false;
      }
    }
  };

  var resize = function() {
    sizeEventsTab();
  };

  var toArray = function(value) {
    if (!value) {
      return [];
    }
    if (value.constructor !== Array) {
      value = [value];
    }
    return value;
  };

  init();
  return self;

};
