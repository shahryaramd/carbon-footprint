

var BUFFDIST = 5000;
var r2 = p2.buffer(BUFFDIST);
var pdict = ee.Dictionary({
          "Biomass":"f0f31e",
          "Coal":"7c7c7c",
          "Gas":"ec83ff",
          "Hydro":"2b1dff",
          "Nuclear":"ff0000",
          "Oil":"1bff0c"}) //,"b6ff05","27ff87","c24f44","a5a5a5","ff6d4c","69fff8","f9ffa4","1c0dff"]};
var plegend = [
      {'Bio-mass': 'f0f31e'}, {'Coal': '7c7c7c'}, {'Gas': 'ec83ff'},
      {'Hydro': '2b1dff'}, {'Nuclear': 'ff0000'}, {'Oil':'1bff0c'}
    ]
    
var features = globalplants.map(function(f) {
  var klass = f.get("fuel1")
  return ee.Feature(ee.Geometry.Point([f.get('longitude'), f.get('latitude')]), f.toDictionary())
      .set({style: {color: pdict.get(klass) }})
})
Map.addLayer(features.style({styleProperty: "style"}),{},'Global power plants')

// Create the application title bar.
Map.add(ui.Label(
    'What Is Our Carbon Footprint?', {fontWeight: 'bold', fontSize: '24px'}));


// Constants used to visualize the data on the map.
var POPULATION_STYLE = {
  min: 0,
  max: 1,
  palette: ['lightyellow', 'da0000']
};
var POPULATION_VIS_MAX_VALUE = 1200;
var POPULATION_VIS_NONLINEARITY = 4;
// Apply a non-linear stretch to the population data for visualization.
function colorStretch(image) {
  return image.divide(POPULATION_VIS_MAX_VALUE)
      .pow(1 / POPULATION_VIS_NONLINEARITY);
}
function undoColorStretch(val) {
  return Math.pow(val, POPULATION_VIS_NONLINEARITY) * POPULATION_VIS_MAX_VALUE;
}
Map.addLayer(colorStretch(pop2015.unmask(0).updateMask(1)), POPULATION_STYLE,'Pop Density');
Map.addLayer(srtm,eleVis,'elev',false)

// Set Panel 
var gas = {
  Methane: 0,
  CO: 2,
  NO2: 3,
  Ozone: 1
};

var img_type = ee.String('Class')


// Create a panel to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '450px','fontSize', '24px')

var ch4leg = ui.Panel();
var no2leg = ui.Panel();
var o3leg = ui.Panel();
var coleg = ui.Panel();
// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'Emission Explorer',
    style: {fontSize: '20px', fontWeight: 'bold'}
  })
  // ui.Label('Select a point')
]);
panel.add(intro);

// Create panels to hold lon/lat values.
var lon = ui.Label();
var lat = ui.Label();
panel.add(ui.Panel([lon, lat], ui.Panel.Layout.flow('horizontal')));

var seldate = ui.Label('',{position: 'top-right'});
Map.add(seldate);

// Add the panel to the ui.root.
ui.root.insert(0, panel);
  
 var intro2 = ui.Panel([
    ui.Label({
    value: 'Select a Greenhouse Gas',
    style: {fontSize: '15px', fontWeight: 'bold'}
  }),
  ]);
// Generates a new time series chart of SST for the given coordinates.
var generateChart = function (coords) {
  // Update the lon/lat panel with values from the click event.
  // ui.root.clear()

  lon.setValue('Selected location >>  lon: ' + coords.lon.toFixed(2));
  lat.setValue('lat: ' + coords.lat.toFixed(2));
  
  panel.remove(intro2)
  var gasselect = ui.Select({
  items: Object.keys(gas),
  onChange: function(key) {
    var product = gas[key]
    // Map.centerObject(ROI)
    GetGasTimeSeries(product)
    seldate.setValue('Median Emission over 2019-20')
    }
  });
  gasselect.style().set('fontSize', '24px')
  gasselect.setPlaceholder('<Greenhouse Gas>');

  intro2 = ui.Panel([
    
    ui.Label('Select a Greenhouse Gas '),
    gasselect 
  ]);
  panel.add(intro2);
  
  // Add a dot for the point clicked on.
  var point = ee.Feature(ee.Geometry.Point(coords.lon, coords.lat),{'Name':'selected-pt'});
  var dot = ui.Map.Layer(point, {color: '0d49db'}, 'selected-pt');
  Map.layers().set(5, dot);
  
  
  var ROI = point.buffer(BUFFDIST);
  var r1 = point.buffer(BUFFDIST);
  // var ROI = geometry2.buffer(5000);
  var start = ee.Date('2018-11-30')
  var end = ee.Date('2020-09-01')
  var date_range = ee.DateRange(start,end);
  
  
  var Nadv = 7
  
  var dates = ee.List.sequence(0,620,Nadv);
  var make_datelist = function(n) {
    return start.advance(n,'day')
  }
  
  dates = dates.map(make_datelist);
  print(dates)

  
  //////////////////////////////////////////
  var GetGasTimeSeries = function(product) {
  
    if (product === 0){
      
    // Accumulate daily CH4
    var dailych4Mean = function (d) {
      var startDate = ee.Date(d);
      var endDate = ee.Date(d).advance(Nadv ,'day');
      var daily = ch4.filterDate(startDate,endDate).select('CH4_column_volume_mixing_ratio_dry_air')
                        .reduce(ee.Reducer.mean())
      var dailytot = daily.set('system:time_start',startDate)
      return dailytot
    }
    
    var ch4daily = ee.ImageCollection(dates.map(dailych4Mean));
    
    // Create chart
    var ch4im = ch4daily
      // .filterBounds(ROI)
      .filterDate(date_range)
      
    print(ch4im)
    Map.addLayer(ch4im.median(),ch4vis,'CH4 median')
    Map.addLayer(point,{color: '0d49db'})
    var bandnameCH4 = 'CH4_column_volume_mixing_ratio_dry_air_mean'
    ch4im = ch4im.select([bandnameCH4])//.map(function (img) {return img.multiply(10000).set('system:time_start',img.get('system:time_start'))})
    
    var chart = ui.Chart.image.seriesByRegion({
      imageCollection: ch4im,
      regions: [r1,r2],
      reducer: ee.Reducer.mean(),
      scale: 4000,
      seriesProperty: 'Name'
    })
      .setOptions({
        title: bandnameCH4
      })
    
    // Add the chart to the map.
    chart.style().set({
      position: 'bottom-right',
      width: '400px',
      height: '300px'
    }); 
    panel.add(chart);
    
    // print(chart)
     chart.onClick(function(xValue, yValue, seriesName) {
        //if (!xValue) return;  // Selection was cleared.
        // Show the image for the clicked date.
        seldate.setValue('Selected Date: ' + ee.Date(xValue).format('YYYY-MM-dd').getInfo())
        var equalDate = ee.Filter.equals('system:time_start', ee.Date(xValue));
        var image = ee.Image(ch4im.filter(equalDate).first());
        var l8Layer = ui.Map.Layer(image, ch4vis, bandnameCH4);
        var popLayer = ui.Map.Layer(colorStretch(pop2015.unmask(0).updateMask(1)), POPULATION_STYLE,'Pop Density');
        var elevLayer = ui.Map.Layer(srtm, eleVis,'elev',false);
        var fireim = fire.filter(ee.Filter.date(ee.Date('2018-01-01'), ee.Date('2020-10-01')));
        var firelayer = ui.Map.Layer(fireim.select('BurnDate'),{
  min: 30.0,
  max: 341.0,
  palette: ['4e0400', '951003', 'c61503', 'ff1901'],
},'fire');
        var plantlayer = ui.Map.Layer(features.style({styleProperty: "style"}),{},'Global power plants')
        Map.layers().reset([popLayer,elevLayer,l8Layer,firelayer,plantlayer])       
     })
     
     
    
    // A color bar widget
    function ColorBar(palette) {
      return ui.Thumbnail({
        image: ee.Image.pixelLonLat().select(0),
        params: {
          bbox: [0, 0, 1, 0.1],
          dimensions: '100x10',
          format: 'png',
          min: 0,
          max: 1,
          palette: palette,
        },
        style: {stretch: 'horizontal', margin: '0px 8px'},
      });
    }
    function makeLegend() {
      var labelPanel = ui.Panel(
          [
            ui.Label(1750, {margin: '4px 8px'}),
            ui.Label(1825, {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
            ui.Label(1900, {margin: '4px 8px'})
          ],
          ui.Panel.Layout.flow('horizontal'));
      return ui.Panel([ColorBar(ch4vis.palette), labelPanel]);
    }
   
    Map.remove(coleg)
    Map.remove(ch4leg)
    Map.remove(no2leg)
    Map.remove(o3leg)
    ch4leg = ui.Panel(
        [
          ui.Label('Methane Emission', LEGEND_TITLE_STYLE), makeLegend(),
          ui.Label(
              'ppbV', LEGEND_FOOTNOTE_STYLE),
          ui.Label(
              'Source: Sentinel-5P (TROPOMI)', LEGEND_FOOTNOTE_STYLE)
        ],
        ui.Panel.Layout.flow('vertical'),
        {width: '230px', position: 'bottom-right'})
    // Assemble the legend panel.
    Map.add(ch4leg);
        

    }
    
    else if(product == 1){
    // ozone ///////////////////////////////
    
    // Accumulate daily
    var dailyozMean = function (d) {
      var startDate = ee.Date(d);
      var endDate = ee.Date(d).advance(Nadv ,'day');
      var daily = ozone.filterDate(startDate,endDate).select('O3_column_number_density')
                        .reduce(ee.Reducer.mean())
      var dailytot = daily.set('system:time_start',startDate)
      return dailytot
    }
    
    var ozdaily = ee.ImageCollection(dates.map(dailyozMean));
    
    // Create chart
    var ozimg = ozdaily
      // .filterBounds(ROI)
      .filterDate(date_range)
      
    print(ozimg)
    Map.addLayer(ozimg.median(),o3vis,'O3 median')
    var bandnameO3 = 'O3_column_number_density_mean'
    ozimg = ozimg.select([bandnameO3]) //,'mean_2m_air_temperature',
     
    var chart = ui.Chart.image.seriesByRegion({
      imageCollection: ozimg,
      regions: [r1,r2],
      reducer: ee.Reducer.mean(),
      scale: 4000,
      seriesProperty: 'Name'
    })
      .setOptions({
        title: bandnameO3
      })
    // Add the chart to the map.
    chart.style().set({
      position: 'bottom-right',
      width: '400px',
      height: '300px'
    }); 
    panel.add(chart);
    
    chart.onClick(function(xValue, yValue, seriesName) {
        //if (!xValue) return;  // Selection was cleared.
        seldate.setValue('Selected Date: ' + ee.Date(xValue).format('YYYY-MM-dd').getInfo())

        // Show the image for the clicked date.
        var equalDate = ee.Filter.equals('system:time_start', ee.Date(xValue));
        var image = ee.Image(ozimg.filter(equalDate).first());
        var l8Layer = ui.Map.Layer(image, o3vis,bandnameO3);
        var popLayer = ui.Map.Layer(colorStretch(pop2015.unmask(0).updateMask(1)), POPULATION_STYLE,'Pop Density');
        var elevLayer = ui.Map.Layer(srtm, eleVis,'elev',false);
        var fireim = fire.filter(ee.Filter.date(ee.Date('2018-01-01'), ee.Date('2020-10-01')));
        var firelayer = ui.Map.Layer(fireim.select('BurnDate'),{
  min: 30.0,
  max: 341.0,
  palette: ['4e0400', '951003', 'c61503', 'ff1901'],
},'fire');
        var plantlayer = ui.Map.Layer(features.style({styleProperty: "style"}),{},'Global power plants')
        Map.layers().reset([popLayer,elevLayer,l8Layer,firelayer,plantlayer])      
    })
    
    
    // A color bar widget
    function ColorBar(palette) {
      return ui.Thumbnail({
        image: ee.Image.pixelLonLat().select(0),
        params: {
          bbox: [0, 0, 1, 0.1],
          dimensions: '100x10',
          format: 'png',
          min: 0,
          max: 1,
          palette: palette,
        },
        style: {stretch: 'horizontal', margin: '0px 8px'},
      });
    }
    function makeLegend() {
      var labelPanel = ui.Panel(
          [
            ui.Label(0.10, {margin: '4px 8px'}),
            ui.Label(0.15, {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
            ui.Label(0.20, {margin: '4px 8px'})
          ],
          ui.Panel.Layout.flow('horizontal'));
      return ui.Panel([ColorBar(o3vis.palette), labelPanel]);
    }
   
    Map.remove(coleg)
    Map.remove(ch4leg)
    Map.remove(no2leg)
    Map.remove(o3leg)
    o3leg = ui.Panel(
        [
          ui.Label('Ozone Emission', LEGEND_TITLE_STYLE), makeLegend(),
          ui.Label(
              'mol/m^2', LEGEND_FOOTNOTE_STYLE),
          ui.Label(
              'Source: Sentinel-5P (TROPOMI)', LEGEND_FOOTNOTE_STYLE)
        ],
        ui.Panel.Layout.flow('vertical'),
        {width: '230px', position: 'bottom-right'})
    // Assemble the legend panel.
    Map.add(o3leg);
    }
    
    else if(product == 2){
    // co ///////////////////////////////
    
    // Accumulate daily
    
    var dailycoMean = function (d) {
      var startDate = ee.Date(d);
      var endDate = ee.Date(d).advance(Nadv ,'day');
      var daily = co.filterDate(startDate,endDate).select('CO_column_number_density')
                        .reduce(ee.Reducer.mean())
      var dailytot = daily.set('system:time_start',startDate)
      return dailytot
    }
    
    var codaily = ee.ImageCollection(dates.map(dailycoMean));
    
    // Create chart
    var coim = codaily
      // .filterBounds(ROI)
      .filterDate(date_range)
      
    print(coim)
    Map.addLayer(coim.median(),covis,'CO median')
    
    var bandnameCO = 'CO_column_number_density_mean'
    coim = coim.select([bandnameCO]) //,'mean_2m_air_temperature',
    
    var chart = ui.Chart.image.seriesByRegion({
      imageCollection: coim,
      regions: [r1,r2],
      reducer: ee.Reducer.mean(),
      scale: 4000,
      seriesProperty: 'Name'
    })
      .setOptions({
        title: bandnameCO
      })
    // Add the chart to the map.
    chart.style().set({
      position: 'bottom-right',
      width: '400px',
      height: '300px'
    }); 
    panel.add(chart);
    chart.onClick(function(xValue, yValue, seriesName) {
        //if (!xValue) return;  // Selection was cleared.
        seldate.setValue('Selected Date: ' + ee.Date(xValue).format('YYYY-MM-dd').getInfo())

        // Show the image for the clicked date.
        var equalDate = ee.Filter.equals('system:time_start', ee.Date(xValue));
        var image = ee.Image(coim.filter(equalDate).first());
        var l8Layer = ui.Map.Layer(image,covis,
        bandnameCO);
        var popLayer = ui.Map.Layer(colorStretch(pop2015.unmask(0).updateMask(1)), POPULATION_STYLE,'Pop Density');
        var elevLayer = ui.Map.Layer(srtm, eleVis,'elev',false);
        
        var fireim = fire.filter(ee.Filter.date(ee.Date('2018-01-01'), ee.Date('2020-10-01')));
        var firelayer = ui.Map.Layer(fireim.select('BurnDate'),{
  min: 30.0,
  max: 341.0,
  palette: ['4e0400', '951003', 'c61503', 'ff1901'],
},'fire');
        var plantlayer = ui.Map.Layer(features.style({styleProperty: "style"}),{},'Global power plants')
        Map.layers().reset([popLayer,elevLayer,l8Layer,firelayer,plantlayer])
      
    })
    // A color bar widget
    function ColorBar(palette) {
      return ui.Thumbnail({
        image: ee.Image.pixelLonLat().select(0),
        params: {
          bbox: [0, 0, 1, 0.1],
          dimensions: '100x10',
          format: 'png',
          min: 0,
          max: 1,
          palette: palette,
        },
        style: {stretch: 'horizontal', margin: '0px 8px'},
      });
    }
    function makeLegend() {
      var labelPanel = ui.Panel(
          [
            ui.Label(0.020, {margin: '4px 8px'}),
            ui.Label(0.028, {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
            ui.Label(0.035, {margin: '4px 8px'})
          ],
          ui.Panel.Layout.flow('horizontal'));
      return ui.Panel([ColorBar(covis.palette), labelPanel]);
    }
   
    Map.remove(coleg)
    Map.remove(ch4leg)
    Map.remove(no2leg)
    Map.remove(o3leg)
    coleg = ui.Panel(
        [
          ui.Label('CO Emission', LEGEND_TITLE_STYLE), makeLegend(),
          ui.Label(
              'mol/m^2', LEGEND_FOOTNOTE_STYLE),
          ui.Label(
              'Source: Sentinel-5P (TROPOMI)', LEGEND_FOOTNOTE_STYLE)
        ],
        ui.Panel.Layout.flow('vertical'),
        {width: '230px', position: 'bottom-right'})
    // Assemble the legend panel.
    Map.add(coleg);
    }
    
    else if(product==3){
    // no2 ///////////////////////////////
    
    // Accumulate daily
    
    var dailyno2Mean = function (d) {
      var startDate = ee.Date(d);
      var endDate = ee.Date(d).advance(Nadv,'day');
      var daily = no2.filterDate(startDate,endDate).select('NO2_column_number_density')
                        .reduce(ee.Reducer.mean())
      var dailytot = daily.set('system:time_start',startDate)
      return dailytot
    }
    
    var no2daily = ee.ImageCollection(dates.map(dailyno2Mean));
    
    // Create chart
    var no2im = no2daily
      // .filterBounds(ROI)
      .filterDate(date_range)
      
    print(no2im)
    Map.addLayer(no2im.median(),no2vis,'NO2 median')
    var bandnameNO2 = 'NO2_column_number_density_mean'
    no2im = no2im.select([bandnameNO2]) //,'mean_2m_air_temperature',
    
    var chart = ui.Chart.image.seriesByRegion({
      imageCollection: no2im,
      regions: [r1,r2],
      reducer: ee.Reducer.mean(),
      scale: 4000,
      seriesProperty: 'Name'
    })
      .setOptions({
        title: bandnameNO2
      })
    // Add the chart to the map.
    chart.style().set({
      position: 'bottom-right',
      width: '400px',
      height: '300px'
    }); 
    panel.add(chart);
    chart.onClick(function(xValue, yValue, seriesName) {
        //if (!xValue) return;  // Selection was cleared.
         seldate.setValue('Selected Date: ' + ee.Date(xValue).format('YYYY-MM-dd').getInfo())
     
        // Show the image for the clicked date.
        var equalDate = ee.Filter.equals('system:time_start', ee.Date(xValue));
        var image = ee.Image(no2im.filter(equalDate).first());
        var l8Layer = ui.Map.Layer(image,no2vis,bandnameNO2);
        var popLayer = ui.Map.Layer(colorStretch(pop2015.unmask(0).updateMask(1)), POPULATION_STYLE,'Pop Density');
        var elevLayer = ui.Map.Layer(srtm, eleVis,'elev',false);
        var fireim = fire.filter(ee.Filter.date(ee.Date('2018-01-01'), ee.Date('2020-10-01')));
        var firelayer = ui.Map.Layer(fireim.select('BurnDate'),{
  min: 30.0,
  max: 341.0,
  palette: ['4e0400', '951003', 'c61503', 'ff1901'],
},'fire');
        var plantlayer = ui.Map.Layer(features.style({styleProperty: "style"}),{},'Global power plants')
        Map.layers().reset([popLayer,elevLayer,l8Layer,firelayer,plantlayer])
    })
    // A color bar widget
    function ColorBar(palette) {
      return ui.Thumbnail({
        image: ee.Image.pixelLonLat().select(0),
        params: {
          bbox: [0, 0, 1, 0.1],
          dimensions: '100x10',
          format: 'png',
          min: 0,
          max: 1,
          palette: palette,
        },
        style: {stretch: 'horizontal', margin: '0px 8px'},
      });
    }
    function makeLegend() {
      var labelPanel = ui.Panel(
          [
            ui.Label(0.00005, {margin: '4px 8px'}),            
            ui.Label(0.00010, {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
            ui.Label(0.00015, {margin: '4px 8px'})
          ],
          ui.Panel.Layout.flow('horizontal'));
      return ui.Panel([ColorBar(no2vis.palette), labelPanel]);
    }
   
    Map.remove(coleg)
    Map.remove(ch4leg)
    Map.remove(no2leg)
    Map.remove(o3leg)
    no2leg = ui.Panel(
        [
          ui.Label('NO2 Emission', LEGEND_TITLE_STYLE), makeLegend(),
          ui.Label(
              'mol/m^2', LEGEND_FOOTNOTE_STYLE),
          ui.Label(
              'Source: Sentinel-5P (TROPOMI)', LEGEND_FOOTNOTE_STYLE)
        ],
        ui.Panel.Layout.flow('vertical'),
        {width: '230px', position: 'bottom-right'})
    // Assemble the legend panel.
    Map.add(no2leg);
    }
  
  }
  
}
// The app is conceptualized, desgined, and coded by Shahryar Khalique Ahmad (http://students.washington.edu/skahmad)
// Please contact skahmad@uw.edu for questions

// IMPORTS
var gldas_coll = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H"),
    gridmet = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET"),
    era = ee.ImageCollection("ECMWF/ERA5/DAILY"),
    gfs = ee.ImageCollection("NOAA/GFS0P25"),
    eram = ee.ImageCollection("ECMWF/ERA5/MONTHLY"),
    ozone = ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_O3"),
    co = ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_CO"),
    no2 = ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2"),
    ch4 = ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_CH4"),
    worldclim = ee.ImageCollection("WORLDCLIM/V1/MONTHLY"),
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY"),
    trmm = ee.ImageCollection("TRMM/3B43V7"),
    ghsl = ee.ImageCollection("JRC/GHSL/P2016/POP_GPW_GLOBE_V1"),
    srtm = ee.Image("USGS/SRTMGL1_003"),
    pop2015 = ee.Image("JRC/GHSL/P2016/POP_GPW_GLOBE_V1/2015"),
    popVis = {"opacity":1,"bands":["population_count"],"min":1,"max":10,"palette":["2214ff","ff5e2d"]},
    eleVis = {"opacity":1,"bands":["elevation"],"min":0,"max":2000,"palette":["1bff18","fff81d","ff2f0e"]},
    covis = {"opacity":1,"bands":["CO_column_number_density_mean"],"min":0.02,"max":0.035,"palette":["145cff","d0ca0b","720202"]},
    o3vis = {"opacity":1,"bands":["O3_column_number_density_mean"],"min":0.1,"max":0.2,"palette":["0e85ff","d9ff0a","760831"]},
    no2vis = {"opacity":1,"bands":["NO2_column_number_density_mean"],"min":0.00004,"max":0.00015,"palette":["1b4cff","fbff19","8f0772"]},
    ch4vis = {"opacity":1,"bands":["CH4_column_volume_mixing_ratio_dry_air_mean"],"min":1750,"max":1900,"palette":["1b37ff","fbff12","8d08a5"]},
    p2 = /* color: #cb0101 */ee.Feature(
        ee.Geometry.Point([-103.83237944411822, 44.83430651642261]),
        {
          "Name": "reference-pt",
          "system:index": "0"
        }),
    powerplants = ee.FeatureCollection("users/climateClass/Power_Plants_US"),
    imageVisParam = {"opacity":1,"bands":["vis-red"],"palette":["f0f31e","7c7c7c","ec83ff","2b1dff","ff0000","1bff0c"]},
    globalplants = ee.FeatureCollection("users/climateClass/Global_Power_Plants"),
    fire = ee.ImageCollection("MODIS/006/MCD64A1");
    
    
// Register a callback on the default map to be invoked when the map is clicked.
Map.onClick(generateChart);

// Configure the map.
Map.style().set('cursor', 'crosshair');

/*
 * The legend panel in the bottom-left
 */

// A color bar widget. Makes a horizontal color bar to display the given
// color palette.
function ColorBar(palette) {
  return ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '100x10',
      format: 'png',
      min: 0,
      max: 1,
      palette: palette,
    },
    style: {stretch: 'horizontal', margin: '0px 8px'},
  });
}
function makeLegend() {
  var labelPanel = ui.Panel(
      [
        ui.Label(Math.round(undoColorStretch(0)), {margin: '4px 8px'}),
        ui.Label(
            Math.round(undoColorStretch(0.5)),
            {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
        ui.Label(Math.round(undoColorStretch(1)), {margin: '4px 8px'})
      ],
      ui.Panel.Layout.flow('horizontal'));
  return ui.Panel([ColorBar(POPULATION_STYLE.palette), labelPanel]);
}

// Styling for the legend title.
var LEGEND_TITLE_STYLE = {
  fontSize: '18px',
  fontWeight: 'bold',
  stretch: 'horizontal',
  textAlign: 'center',
  margin: '4px',
};

// Styling for the legend footnotes.
var LEGEND_FOOTNOTE_STYLE = {
  fontSize: '10px',
  stretch: 'horizontal',
  textAlign: 'center',
  margin: '4px',
};

// Assemble the legend panel.
Map.add(ui.Panel(
    [
      ui.Label('Population Density', LEGEND_TITLE_STYLE), makeLegend(),
      ui.Label(
          '(thousands of people per square kilometer)', LEGEND_FOOTNOTE_STYLE),
      ui.Label(
          'Source: Global Human Settlement Layer (JRC)', LEGEND_FOOTNOTE_STYLE)],
    ui.Panel.Layout.flow('vertical'),
    {width: '230px', position: 'bottom-left'}));
Map.add(ui.Label('Select point on the map to explore', {position: 'bottom-left'}))


var dataset = ee.ImageCollection('MODIS/006/MCD12Q1');
var igbpLandCover = dataset.select('LC_Type1');
var igbpLandCoverVis = {
  min: 1.0,
  max: 17.0,
  palette: [
    '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
    'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
    '69fff8', 'f9ffa4', '1c0dff'
  ],
};
// Map.setCenter(6.746, 46.529, 6);
Map.addLayer(igbpLandCover, igbpLandCoverVis, 'IGBP Land Cover',false);



// legend for power plant
var legendpp = ui.Label('Powerplant Type',{position: 'top-right'});
panel.add(legendpp);

var legendPanel = ui.Panel({
  style:
      {fontWeight: 'bold', fontSize: '10px', margin: '0 0 0 8px', padding: '0'}
});
var legendTitle = ui.Label(
    'Legend',
    {fontWeight: 'bold', fontSize: '10px', margin: '0 0 4px 0', padding: '0'});
legendPanel.add(legendTitle);

var keyPanel = ui.Panel();
legendPanel.add(keyPanel);


function setLegend(legend) {
  // Loop through all the items in a layer's key property,
  // creates the item, and adds it to the key panel.
  keyPanel.clear();
  for (var i = 0; i < legend.length; i++) {
    var item = legend[i];
    var name = Object.keys(item)[0];
    var color = item[name];
    var colorBox = ui.Label('', {
      backgroundColor: color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '5px'
    });
    // Create the label with the description text.
    var description = ui.Label(name, {margin: '0 0 4px 6px'});
    keyPanel.add(
        ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
  }
}

// Set the initial legend.
setLegend(plegend);
panel.add(keyPanel)



