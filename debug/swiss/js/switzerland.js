$(document).ready(function(){

    var latlon = [52.5167, 13.3833];
    latlon = [46.9500, 7.4500];
    latlon = [47.37417465983494,8.53363037109375];

    // add the map and set the initial center to berlin
    var map = L.map('map', {zoomControl : false}).setView(latlon, 12);
    // attribution to give credit to OSM map data and VBB for public transportation 
    var attribution ="<a href='https://www.mapbox.com/about/maps/' target='_blank'>© Mapbox © OpenStreetMap</a> | Transit Data © <a href='http://gtfs.geops.ch/' target='_blank'>Geops.ch</a> | developed by <a href='http://www.route360.net/de/' target='_blank'>Route360°</a>";

    // initialising the base map. To change the base map just change following
    // lines as described by cloudmade, mapbox etc..
    // note that mapbox is a paided service mi.0ad4304c
    var tileLayer = L.tileLayer('https://a.tiles.mapbox.com/v3/mi.0ad4304c/{z}/{x}/{y}.png', {
    // var tileLayer = L.tileLayer('https://a.tiles.mapbox.com/v3/mi.h220d1ec/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: attribution }).addTo(map);

    var maxSources = 3;
    var currentRoute;
    var elevationData = [];

    var elevationColors = [{
        label               : "1",
        fillColor           : "#d43e2a",
        fillColorOpacity    : 0.1,
        strokeColor         : "#d43e2a",
        strokeColorOpacity  : 0.7
    },{
        label               : "2",
        fillColor           : "#f69730",
        fillColorOpacity    : 0.1,
        strokeColor         : "#f69730",
        strokeColorOpacity  : 0.7
    },{
        label               : "3",
        fillColor           : "#38aadd",
        fillColorOpacity    : 0.1,
        strokeColor         : "#38aadd",
        strokeColorOpacity  : 0.7
    }];

    var sourceMarker  = '';
    var targetMarker  = '';
    var travelType    = '';
    var autoCompletes = [];
    var sourceMarkers = _.range(maxSources);
    var routeLayer    = L.featureGroup().addTo(map);
    var sourceLayer   = L.featureGroup().addTo(map);
    var rentalLayer   = L.featureGroup().addTo(map);
    var targetLayer   = L.featureGroup().addTo(map);
    var polygonLayer  = r360.route360PolygonLayer().addTo(map);

    // set the service key, this is a demo key
    // please contact us and request your own key
    r360.config.serviceKey                                  = 'uhWrWpUhyZQy8rPfiC7X';
    r360.config.serviceUrl                                  = 'http://api.route360.net/api_switzerland_0.0.2/';
    // r360.config.serviceUrl                                  = 'http://localhost:8080/api/';
    r360.config.defaultPlaceAutoCompleteOptions.serviceUrl  = "http://geocode2.route360.net/solr/select?"; 
    // r360.config.defaultPolygonLayerOptions.animate          = false;
    r360.config.defaultPolygonLayerOptions.inverse          = true;
    r360.config.nominatimUrl                                = 'http://geocode2.route360.net/nominatim/';
    
    var options = { bike : true, walk : true, car : true, transit : true, init : 'car' };

    // define which options the user is going to have
    for ( var i = 0 ; i < maxSources ; i++ ) {

        var addAutoComplete = function(i) {

            var autoComplete = r360.placeAutoCompleteControl({ country : "Switzerland", placeholder : 'Select source!', reset : true, index : i, reverse : false, image : 'images/source'+i+'.png', options : options});

            // // if someone changes the travel type for the source
            // we need to get new polygons and new routes
            autoComplete.onTravelTypeChange(updateSource);

            // if someone clicks a place from the dropdown, we remove the old source
            // and create a new one and get new polygons
            autoComplete.onSelect(function(item){

                sourceLayer.clearLayers();
                createMarker(item.latlng, 'home', item.index == 0 ? 'red' : (item.index == 1 ? 'orange' : 'blue'), sourceLayer, updateSource, 'undefined', item.index);
                updateSource();
            });

            autoComplete.onReset(function(){

                polygonLayer.clearLayers();
                routeLayer.clearLayers();
                autoComplete.reset();
                sourceLayer.removeLayer(sourceMarkers[autoComplete.getIndex()]);
                sourceMarkers[autoComplete.getIndex()] = autoComplete.getIndex();
                updateSource();
            });

            autoCompletes.push(autoComplete);
            map.addControl(autoComplete);
        }

        addAutoComplete(i);
    }

    var targetAutoComplete = r360.placeAutoCompleteControl({ country : "Switzerland", placeholder : 'Select source!', reset : true, reverse : false , image : 'images/target.png' });
    // map.addControl(targetAutoComplete);

    targetAutoComplete.onSelect(function(item){

        targetLayer.clearLayers();

        targetMarker = L.marker(item.latlng, { draggable : true, icon: L.AwesomeMarkers.icon({ icon: 'flag-checkered', prefix : 'fa', markerColor: 'green' })});
        if ( typeof popup != 'undefined') targetMarker.bindPopup(popup);
        targetMarker.on('dragend', updateTarget);
        targetMarker.addTo(targetLayer);

        updateTarget();
    });

    targetAutoComplete.onReset(function(){

        routeLayer.clearLayers();
        targetLayer.clearLayers();
        targetAutoComplete.reset();
        targetMarker = '';
    });

    // add the controls to the map
    map.addControl(L.control.zoom({ position : 'bottomleft' }));
    var waitControl = r360.waitControl({ position : 'bottomright' });
    map.addControl(waitControl);

    r360.config.defaultTravelTimeControlOptions.travelTimes = [
        { time : 600  , color : "#006837", opacity : 1.0 },
        { time : 1200 , color : "#39B54A", opacity : 1.0 },
        { time : 1800 , color : "#8CC63F", opacity : 1.0 },
        { time : 2400 , color : "#F7931E", opacity : 1.0 },
        { time : 3000 , color : "#F15A24", opacity : 1.0 },
        { time : 3600 , color : "#C1272D", opacity : 1.0 }
    ];

    var travelTimeControl       = r360.travelTimeControl({
        travelTimes : r360.config.defaultTravelTimeControlOptions.travelTimes,
        position    : 'topright', // this is the position in the map
        label       : 'Travel time: ', // the label, customize for i18n
        initValue   : 20 // the inital value has to match a time from travelTimes, e.g.: 40m == 2400s
    });

    var intersectionButtons = r360.radioButtonControl({
        buttons : [
            // each button has a label which is displayed, a key, a tooltip for mouseover events 
            // and a boolean which indicates if the button is selected by default
            // labels may contain html
            { label: '<span class=""></span> Union', key: 'union', checked : true },
            { label: '<span class=""></span> Intersection', key: 'intersection', checked : false  },
            { label: '<span class=""></span> Average', key: 'average', checked : false }
        ]
    });

    var polygonButtons = r360.radioButtonControl({
        buttons : [
            // each button has a label which is displayed, a key, a tooltip for mouseover events 
            // and a boolean which indicates if the button is selected by default
            // labels may contain html
            { label: '<span class=""></span> Color', key: 'color',   checked : false  },
            { label: '<span class=""></span> B/W',   key: 'inverse', checked : true }
        ]
    });

    // what happens if action is performed
    polygonButtons.onChange(function(){ 

        r360.config.defaultPolygonLayerOptions.inverse = !r360.config.defaultPolygonLayerOptions.inverse;
        updateSource();
    });
    intersectionButtons.onChange(updateSource);
    travelTimeControl.onSlideStop(updateSource);
    
    // add to map
    map.addControl(travelTimeControl);
    map.addControl(intersectionButtons);
    map.addControl(polygonButtons);

    $('span[lang="de"]').hide();

    // ==================================================================================================================================
    // ----------------------------------------------------------------------------------------------------------------------------------
    // 
    //                                              END OF INITIALIZE
    // 
    // ----------------------------------------------------------------------------------------------------------------------------------
    // ==================================================================================================================================

    // the first click on a map creates a source marker
    // the second click creates or relocates the target marker
    map.on('click', function(e){

        var index0 = _.indexOf(sourceMarkers, 0);
        var index1 = _.indexOf(sourceMarkers, 1);
        var index2 = _.indexOf(sourceMarkers, 2);

        // create source marker and make a polygon request
        if (  index0 >= 0 || index1 >= 0 || index2 >= 0 ) {

            var min = _.min(_.without([index0, index1, index2], -1));
            createMarker(e.latlng, 'home',  min == 0 ? 'red' : (min == 1 ? 'orange' : 'blue'), sourceLayer, updateSource, 'undefined', min);
            updateSource();
        }
        // // only so many source markers are allowed
        else {

            targetLayer.clearLayers();

            targetMarker = L.marker(e.latlng, { draggable : true, icon: L.AwesomeMarkers.icon({ icon: 'flag-checkered', prefix : 'fa', markerColor: 'green' })});
            if ( typeof popup != 'undefined') targetMarker.bindPopup(popup);
            targetMarker.on('dragend', updateTarget);
            targetMarker.addTo(targetLayer);

            updateTarget();
        }
    });

    /**
     * [updateAutocomplete Updates the label and latlng value of an autocomplete component, by a reverse geocoding request to nominatim.]
     * @param  {[type]} autoComplete [the autocomplete to update]
     * @param  {[type]} marker       [the marker from which the latlng object get's reverse geocoded.]
     */
    function updateAutocomplete(){

        for ( var j = 0 ; j < maxSources ; j++ ) {

            if ( typeof sourceMarkers[j] != 'number' ) {

                var sourceMarker        = sourceMarkers[j];
                sourceMarker.travelType = autoCompletes[j].getTravelType();
                sourceMarker.index      = autoCompletes[j].getIndex();

                var update = function(index) {

                    // update the street in the autocomplete
                    r360.Util.getAddressByCoordinates(sourceMarker.getLatLng(), 'de', function(json){

                        var displayName = r360.Util.formatReverseGeocoding(json);
                        autoCompletes[index].setValue({ firstRow : displayName, latlng : sourceMarker.getLatLng(), label : displayName });
                        autoCompletes[index].setFieldValue(displayName);
                        sourceMarker.bindPopup(displayName);
                    });    
                };

                update(autoCompletes[j].getIndex());
            }
        }
    }

    function updateTargetAutocomplete(){

        // update the street in the autocomplete
        r360.Util.getAddressByCoordinates(targetMarker.getLatLng(), 'de', function(json){

            var displayName = r360.Util.formatReverseGeocoding(json);
            targetAutoComplete.setValue({ firstRow : displayName, latlng : targetMarker.getLatLng(), label : displayName });
            targetAutoComplete.setFieldValue(displayName);
            targetMarker.bindPopup(displayName);
        });    
    }

    /**
     * [updateSource This method updates the polygons, and performs a reverse geocoding for the update of the
     * autoComplete and get's new routes if a target is defined.]
     */
    function updateSource() {

        getPolygons();
        updateAutocomplete();
        if ( targetMarker !== '' ) getRoutes();
    }

    /**
     * [updateTarget This method gets new routes and updates the target autocomplete with a reverse geocoding.]
     * @return {[type]} [description]
     */
    function updateTarget() {

        getRoutes();
        updateTargetAutocomplete();
    }

    /**
     * [createMarker Creates a leaflet awesome marker with predefined properties]
     * @param  {[LatLng]} latLng  [the lat/lng location of the marker]
     * @param  {[type]} icon    [the string value of font awesome icon, e.g. 'home' (no 'fa-')]
     * @param  {[type]} color   [the color of the marker, as defined by awesomeMarkers.css]
     * @param  {[type]} layer   [the layer to which to add the marker]
     * @param  {[type]} dragend [the callback function that is called if the marker is draged in the map]
     * @param  {[type]} popup   [the popup to show if someone clicks on the marker]
     * @return {[Marker]}         [the leaflet marker]
     */
    function createMarker(latLng, icon, color, layer, dragend, popup, index){

        var marker = L.marker(latLng, { draggable : true, icon: L.AwesomeMarkers.icon({ icon: icon, prefix : 'fa', markerColor: color })});
        if ( typeof popup != 'undefined') marker.bindPopup(popup);
        marker.on('dragend', dragend);

        sourceMarkers[index] = marker;

        for ( var i = 0 ; i < maxSources ; i++ ) 
            if ( typeof sourceMarkers[i] != 'number' )
                sourceMarkers[i].addTo(layer);

        return marker;
    }

    /**
     * [getRoutes This method performs a request to the r360 webservice for the configured source and target with the specified travel options.
     * The returned data from the service is then used to paint the routes on the map and to create a pretty popup with elevation data in the 
     * leaflet marker popup.]
     */
    function getRoutes(){

        routeLayer.clearLayers();

        var travelOptions = r360.travelOptions();
        for ( var i = 0 ; i < maxSources ; i++ ) {
            if ( typeof sourceMarkers[i] != 'number' ) {

                var sourceMarker        = sourceMarkers[i];
                sourceMarker.travelType = autoCompletes[i].getTravelType();
                travelOptions.addSource(sourceMarker);            
            }
        }

        travelOptions.setDate('20150115');
        travelOptions.setTime('39600');
        travelOptions.setElevationEnabled(true);
        travelOptions.setWaitControl(waitControl);
        travelOptions.addTarget(targetMarker);

        r360.RouteService.getRoutes(travelOptions, function(routes) {

            var data         = [];
            var longestLabel = [];
            var html        = 
                '<table class="table table-striped"> \
                    <thead>\
                        <tr>\
                          <th>Source</th>\
                          <th>Travel time</th>\
                          <th>Distance</th>\
                        </tr>\
                    </thead>';

            _.each(routes, function(route, index){

                currentRoute = route;
                route.fadeIn(routeLayer, 500, "travelDistance", { color : elevationColors[index].strokeColor, haloColor : "#ffffff" });

                html +=
                    '<tr style="margin-top:5px;">\
                        <td class="routeModus routeModus'+index+'"><img style="height: 25px;" src="images/source'+index+'.png"></td>\
                        <td>' + r360.Util.secondsToHoursAndMinutes(currentRoute.getTravelTime()) + '</td>\
                        <td>' + currentRoute.getDistance().toFixed(2) + ' km</td>\
                    </tr>'

                var elevations = currentRoute.getElevations();

                if ( elevations.x.length > longestLabel.length) 
                    longestLabel = elevations.x;

                data.push({
                    data        : elevations.y.reverse(),
                    fillColor   : "rgba(" + hexToRgb(elevationColors[index].fillColor).join(', ') + ", " +  elevationColors[index].fillColorOpacity + ")",
                    strokeColor : "rgba(" + hexToRgb(elevationColors[index].strokeColor).join(', ') + ", " +  elevationColors[index].strokeColorOpacity + ")",
                });
            });

            html += 
                '</table>\
                <canvas id="elevationChart" width="400" height="200"></canvas>';

            targetMarker.bindPopup(html);
            targetMarker.openPopup();

            new Chart(document.getElementById("elevationChart").getContext("2d")).Line({
                labels: longestLabel,
                datasets: data
            }, { pointDot : false, scaleShowGridLines: false, showXLabels : 10, showTooltips: false });

            $('.routeModus0').css('background-color', "rgba(" + hexToRgb(elevationColors[0].fillColor).join(', ') + ", " +  elevationColors[0].fillColorOpacity + ")");
            $('.routeModus1').css('background-color', "rgba(" + hexToRgb(elevationColors[1].fillColor).join(', ') + ", " +  elevationColors[1].fillColorOpacity + ")");
            $('.routeModus2').css('background-color', "rgba(" + hexToRgb(elevationColors[2].fillColor).join(', ') + ", " +  elevationColors[2].fillColorOpacity + ")");
            $('.routeModus0').css('border', "1px solid rgba(" + hexToRgb(elevationColors[0].strokeColor).join(', ') + ", " +  elevationColors[0].strokeColorOpacity + ")");
            $('.routeModus1').css('border', "1px solid rgba(" + hexToRgb(elevationColors[1].strokeColor).join(', ') + ", " +  elevationColors[1].strokeColorOpacity + ")");
            $('.routeModus2').css('border', "1px solid rgba(" + hexToRgb(elevationColors[2].strokeColor).join(', ') + ", " +  elevationColors[2].strokeColorOpacity + ")");
        });
    };

    /**
     * [getPolygons This method performs a webservice request to the r360 polygon service for the specified source and travel options.
     * The returned travel type polygons are then painted on the map]
     * @return {[type]} [description]
     */
    function getPolygons(){

        var index0 = _.indexOf(sourceMarkers, 0);
        var index1 = _.indexOf(sourceMarkers, 1);
        var index2 = _.indexOf(sourceMarkers, 2);

        // create source marker and make a polygon request
        if (  index0 == -1 || index1 == -1 || index2 == -1 ) {

            var travelOptions = r360.travelOptions();

            for ( var i = 0 ; i < maxSources ; i++ ) {
                if ( typeof sourceMarkers[i] != 'number' ) {

                    var sourceMarker        = sourceMarkers[i];
                    sourceMarker.travelType = autoCompletes[i].getTravelType();
                    travelOptions.addSource(sourceMarker);            
                }
            }

            travelOptions.setIntersectionMode(intersectionButtons.getValue());
            travelOptions.setTravelTimes(travelTimeControl.getValues());
            travelOptions.setWaitControl(waitControl);
            travelOptions.setElevationEnabled(true);
            travelOptions.setDate('20150114');
            travelOptions.setTime('39600');

            var maxTravelTime = _.max(travelTimeControl.getValues());

            if ( maxTravelTime == 1200 || maxTravelTime == 2400 )
                travelOptions.setMinPolygonHoleSize(1 * 1000 * 1000);
            if ( maxTravelTime == 3600 || maxTravelTime == 4800 )
                travelOptions.setMinPolygonHoleSize(10 * 1000 * 1000);
            if ( maxTravelTime == 6000 || maxTravelTime == 7200 )
                travelOptions.setMinPolygonHoleSize(100 * 1000 * 1000);

            if ( r360.config.defaultPolygonLayerOptions.inverse ) 
                travelOptions.setTravelTimes([_.max(travelTimeControl.getValues())]);
            
            // call the service
            r360.PolygonService.getTravelTimePolygons(travelOptions, function(polygons){
                polygonLayer.clearAndAddLayers(polygons);

                map.fitBounds(polygonLayer.getBoundingBox());
                
            });
        }
    }

    /**
     * [hexToRgb This method returns the rgb values of a hex color in form of an array.]
     * @param  {[type]} hex [the color in hex]
     * @return {[type]}     [an array with 3 entries for r, g and b]
     */
    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : null;
    }
});