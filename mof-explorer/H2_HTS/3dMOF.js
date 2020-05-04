google.charts.load("current", {'packages':["corechart", "table", "controls"]});
google.charts.setOnLoadCallback(init);

// GLOBAL VARIABLES
var dataTable, chart, options;
var table, view;
var tableView, filterView;
var plotlyPlot;
var slider, colorSelector, sizeSelector, xSelect, ySelect;
var pressureOverlay;
var minSizeText; var maxSizeText; var sizeTitle; var colorbartitle;
var coarseSliderValue; var oldSliderValue = null;
var filterRows = [];
var allRows = []; selectAllArray = [];
var gettingPointsFromGraph = false;
var reDraw = true; var relaying = false;
var sizeAxisGroup = null;
var pointIndex = -1;
var twoD = true;
var cmax = 4; var smax = 24;
var hmax = 28; var vmax = 320; var zmax = 28;
var currentSelection = null;

// INITIAL FUNCTION
function init(){
  // This function runs when Google charts js is ready

  // Fill in global variables
  pressureList = [200, 500, 900];
  pressureOverlay = document.getElementById('pressureOverlay');

  plotlyPlot = document.getElementById('chart_div');

  slider = document.getElementById('slider');
  slider.addEventListener('input', onSliderUpdate);

  colorSelector = document.getElementById('colorSelect');
  colorSelector.addEventListener('change', selectChange);

  sizeSelector = document.getElementById('sizeSelect');
  sizeSelector.addEventListener('change', selectChange);

  xSelector = document.getElementById('xSelect');
  xSelector.addEventListener('change', selectChange);

  ySelector = document.getElementById('ySelect');
  ySelector.addEventListener('change', selectChange);

  zSelector = document.getElementById('zSelect');
  zSelector.addEventListener('change', selectChange);

  zDiv = document.getElementById('zDiv');

  filterGraphButton = document.getElementById('filterGraphButton');

  minSizeText = document.getElementById('sizeAxisMinText');
  maxSizeText = document.getElementById('sizeAxisMaxText');
  sizeTitle = document.getElementById('sizeAxisTitle');

  axesLabels = ['Name', 'Family', 'Framework Dimensionality', 'Functional Groups',
  'Functional Group Class', ' ', 'Framework Mass, g/mol', 'Framework Density, g/cm\u00B3', 
  'Void Fraction', ' ', 'Volumetric Surface Area, m\u00B2/cm\u00B3', 'Gravimetric Surface Area, m\u00b2/g',
  'Pore Limiting Diameter, \u212B', 'Largest Cavity Diameter, \u212B', 'Percolation', 'R-factor', 'Year', 'In a Chiral Space Group?',
'Contains chiral atoms?', 'SQUEEZEd?', 'Crystal System', 'Space Group', 'Metals',   
                'Uptake, wt.%', 'Uptake, g/L', 'Heat of Adsorption, kJ/mol'];

  shortLabels = ['Name', 'Fam.', 'Frame. Dim', 'Func. Gr.', 'Func. Gr. Class', ' ', 'Frame. Mass, g/mol', 'Frame. Den., g/cm\u00B3', 
  'VF', ' ',  'VSA, m\u00B2/cm\u00B3', 'GSA, m\u00b2/g', 'PLD, \u212B', 'LCD, \u212B', 'Perc.', 'R', 'Year', 'Chir. SG', 'Chir. atom.', 'SQ', 'CS', 'SG',
  'M', 'Up., wt.%', 'Up., g/L', 'Qst, kJ/mol'];

	layout = {
          font: {family: 'Open Sans'},
          margin: {l: 50, r: 0, t:20, b:50},
					scene: {
						xaxis: {title: '', titlefont: {family: 'PT Sans Narrow'}},
						yaxis: {title: '', titlefont: {family: 'PT Sans Narrow'}},
            zaxis: {title: '', titlefont: {family: 'PT Sans Narrow'}},
            aspectratio: {x: 3, y: 1, z: 1},
            camera: {}
					},
          xaxis: {title: ''},
          yaxis: {title: ''},
          zaxis: {title: ''},
          hovermode: 'closest'
				};

  // Get data table from browser cache if possible
  var db;
  var requestDB = window.indexedDB.open("h2data");

  requestDB.onupgradeneeded = function(event){
    console.log("upgrade needed!")
    db = requestDB.result;
    db.createObjectStore("h2mofs", {keyPath: "id"});

    var rangeString = encodeURIComponent('range=A:AH');
    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/1G3mEBeehKO_RtTt0XIRnxfKJ3Pg6GpUd8peZ7AUzQvE/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);
  };

  requestDB.onsuccess = function(event){
    db = requestDB.result;

    // Get data from the database
    var request = db.transaction(["h2mofs"]).objectStore("h2mofs").get("01");

    request.error = function(event){
      console.log('Some error in database request.')
    }

    request.onsuccess = function(event){
      if (request.result != null){
        console.log('Loading table from local indexedDB.');
        var dataString = request.result.data;
        var parsedData = JSON.parse(dataString);
        dataTable = new google.visualization.DataTable(parsedData);
        // Draw initial chart
        initialiseChart();
      }
    }

  };

}

// GET DATA TABLE
function handleQueryResponse(response) {
  if (response.isError()) {
    alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  // Get data, and store it in local indexedDB
  dataTable = response.getDataTable();
  var dataString = JSON.stringify(dataTable);
  var requestDB = window.indexedDB.open("h2data");
  requestDB.onsuccess = function(event){
    db = requestDB.result;
    var request = db.transaction(["h2mofs"], "readwrite").objectStore("h2mofs").add({id: "01", data: dataString});

    request.onsuccess = function(event){console.log('Saved remote MOF data to local indexedDB.');};
    request.onerror = function(event){console.log('Failed to save data to local indexedDB. Will try loading chart anyway.');};
  };
  initialiseChart();
}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AH');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/1G3mEBeehKO_RtTt0XIRnxfKJ3Pg6GpUd8peZ7AUzQvE/gviz/tq?gid=0&headers=1&' + rangeString);
  query.send(handleQueryResponse);
  // Close help dialog
  document.getElementById('help-modal').style.display='none';
}

// FIRST DRAW OF CHART
function initialiseChart(){
  for (i=0; i<dataTable.getNumberOfRows(); i++){
    allRows.push(i);
    selectAllArray.push({'row': i, 'column': null});
  }

  dash = new google.visualization.Dashboard(document.getElementById('dashboard'));
  filterTable = new google.visualization.Table(document.getElementById('filterTable_div'));
  graphFilterTable = new google.visualization.Table(document.getElementById('graph-filterTable_div'));

  var stringFilter = new google.visualization.ControlWrapper({
    'controlType': 'StringFilter',
    'containerId': 'control1',
    'options': {
      'filterColumnIndex': 0
    }
  });
  table = new google.visualization.ChartWrapper({
    'chartType': 'Table',
    'containerId': 'table_div',
    'options': {'height': '100%', 'width': '100%'}
  });
  dash.bind(stringFilter, table);

  // Set up views
  tableView = new google.visualization.DataView(dataTable);
  filterView = new google.visualization.DataView(dataTable);
  graphFilterView = new google.visualization.DataView(dataTable);
  view = new google.visualization.DataView(dataTable);

  // Draw first chart - note onSliderUpdate() calls drawBubbleChart()
  onSliderUpdate();
}

function drawBubbleChart(){
  setAxisSize();
  xValue = parseInt(xSelector.value);
  yValue = parseInt(ySelector.value);
  zValue = parseInt(zSelector.value);
  cValue = parseInt(colorSelector.value);
  sValue = parseInt(sizeSelector.value);

  columns = getColumns(xValue, yValue, cValue, sValue, zValue);

  view.setColumns(columns);
  if (filterRows.length > 0){
    view.setRows(filterRows);
  } else {
    // Empty filter means plot all rows
    view.setRows(allRows);
  }

  colorbarTitle = axesLabels[cValue];
  layout.xaxis.title = axesLabels[xValue];
  layout.yaxis.title = axesLabels[yValue];
  layout.scene.xaxis.title = axesLabels[xValue];
  layout.scene.zaxis.title = axesLabels[yValue]; // Note z is vertical axis in 3D view
  layout.scene.yaxis.title = axesLabels[zValue]; // Note z is vertical axis in 3D view

  sizeTitle.innerHTML = axesLabels[sValue];
  if (isNumericalParameter(sValue)) {
    maxSizeText.innerHTML = view.getColumnRange(4).max.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
    minSizeText.innerHTML = view.getColumnRange(4).min.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");
  } else {
    maxSizeText.innerHTML = 'n/a';
    minSizeText.innerHTML = 'n/a';
  }

  hmax = (xValue == 23) ? 30 : (xValue == 24) ? 50 : (xValue == 25) ? 22 : view.getColumnRange(1).max;
  vmax = (yValue == 23) ? 30 : (yValue == 24) ? 50 : (yValue == 25) ? 22 : view.getColumnRange(2).max;
  zmax = (zValue == 23) ? 30 : (zValue == 24) ? 50 : (zValue == 25) ? 22 : view.getColumnRange(5).max;
  cmax = (cValue == 23) ? 30 : (cValue == 24) ? 50 : (cValue == 25) ? 22 : view.getColumnRange(3).max;
  smax = (sValue == 23) ? 30 : (sValue == 24) ? 50 : (sValue == 25) ? 22 : view.getColumnRange(4).max;

	drawPlotlyChart();

  var pressure = pressureList[Math.floor(coarseSliderValue)];
  pressureOverlay.innerHTML = pressure + ' bar';
}

function drawPlotlyChart(){
  var trace = {
    x:columnToArray(1),
    mode: 'markers',
    text: columnToArray(0),
    hoverinfo: "text",
    marker: {
      size: columnToArray(4),
      sizeref: smax/20,
      sizemin: 2,
      line: {width: 0.0},
      color: columnToArray(3),
      opacity: 0.9
    }
  };

  // Trace settings for 2D/3D
  if (twoD){
    trace.y = columnToArray(2);
    trace.type = 'scatter';
  } else {
    trace.y = columnToArray(5);
    trace.z = columnToArray(2);
    trace.type = 'scatter3d';
    layout.aspectratio = {x: 3, y: 1, z: 1};
  }

  var markerNameList = null;
  var markerColorList = null;

  if (isNumericalParameter(cValue)) {
    trace.marker.colorbar = {title: colorbarTitle, titleside: 'right'};
    trace.marker.colorscale = 'Viridis';
    trace.marker.autocolorscale = false;
    trace.marker.showscale = true;
  } else {
      trace.marker.showscale = false;
      trace.showlegend = false;
      layout.showlegend = true;

      markerNames = columnToArray(3);
      markerNameList = uniq(markerNames);
      markerColorList = getColorListFromNameList(markerNameList);
      markerColors = [];
      for (i=0; i<markerNames.length; i++){
        markerColors.push(markerColorList[markerNameList.indexOf(markerNames[i])]);
      }
      trace.marker.color = markerColors;
      trace.text = columnToArray(3);
  }

  // Create a custom legend (or hide the legend if markerNameList is null!)
  customLegend(markerNameList, markerColorList);

	var data = [trace];

  // Draw annotation, if necessary
  if (currentSelection == null){
    layout.annotations = [];
  } else {
    var viewRow = view.getViewRowIndex(currentSelection);
    var xLoc = view.getValue(viewRow, 1);
    var yLoc = view.getValue(viewRow, 2);
    if (twoD){
      // Annotations don't work in 3D :(
      var xAnno = view.getValue(viewRow, 1);
      var yAnno = view.getValue(viewRow, 2);
      var cAnno = view.getValue(viewRow, 3);
      var sAnno = view.getValue(viewRow, 4);

      if (typeof xAnno === 'number') xAnno = xAnno.toPrecision(4);
      if (typeof yAnno === 'number') yAnno = yAnno.toPrecision(4);
      if (typeof cAnno === 'number') cAnno = cAnno.toPrecision(4);
      if (typeof sAnno === 'number') sAnno = sAnno.toPrecision(4);

      var annoText = '<b>' + view.getValue(viewRow, 0) + '<a href="https://www.ccdc.cam.ac.uk/structures/Search?Ccdcid=' + view.getValue(viewRow, 0) + '">(CSD link)</a><br />' + 
        layout.xaxis.title + ': ' + xAnno + '<br>' +
        layout.yaxis.title + ': ' + yAnno + '<br>' +
        colorbarTitle + ': ' + cAnno + '<br>' +
        sizeTitle.innerHTML + ': ' + sAnno + '<br>';

	    layout.annotations = [{x: xLoc, y: yLoc, text: annoText, showarrow: true,
        arrowhead: 7, arrowsize:1, arrowwidth:2, ax: 200, ay: 10, align: 'right',
        xref: 'x', yref: 'y', bgcolor: '#666666', opacity: 0.8, font: {color: 'white'}}];
      }
  }

	if(reDraw){
      layout.xaxis.range = isNumericalParameter(xValue) ? [0, hmax] : null;
      layout.yaxis.range = isNumericalParameter(yValue) ? [0, vmax] : null;
      layout.scene.xaxis.range = isNumericalParameter(xValue) ? [0, hmax] : null;
      layout.scene.zaxis.range = isNumericalParameter(yValue) ? [0, vmax] : null; // Note z is vertical axis in 3D view
      layout.scene.yaxis.range = isNumericalParameter(zValue) ? [0, zmax] : null;

      layout.xaxis.type = isNumericalParameter(xValue) ? 'scatter' : 'category';
      layout.yaxis.type = isNumericalParameter(yValue) ? 'scatter' : 'category';
      layout.scene.xaxis.type = isNumericalParameter(xValue) ? 'scatter' : 'category';
      layout.scene.zaxis.type = isNumericalParameter(yValue) ? 'scatter' : 'category'; // Note z is vertical axis in 3D view
      layout.scene.yaxis.type = isNumericalParameter(zValue) ? 'scatter' : 'category';

    layout.scene.camera = {center: {x: 0, y: 0, z: -0.1},
                    eye: {x: 0.02, y: -2.2, z: 0.1}}; // up = 0 1 0 ?
		Plotly.newPlot('chart_div', data, layout);

    // Set up events
    plotlyPlot.on('plotly_click', debounce(pointSelected, 200));
    plotlyPlot.on('plotly_relayout', function(){relaying=true;});
		reDraw = false;
	}else{
    if (!twoD){
      layout.scene.camera = {center: {x: chart_div._fullLayout.scene._scene.camera.center[0],
                                      y: chart_div._fullLayout.scene._scene.camera.center[1],
                                      z: chart_div._fullLayout.scene._scene.camera.center[2]},
                             eye:    {x: chart_div._fullLayout.scene._scene.camera.eye[0],
                                      y: chart_div._fullLayout.scene._scene.camera.eye[1],
                                      z: chart_div._fullLayout.scene._scene.camera.eye[2]}
                          };
    }
		Plotly.animate('chart_div', {data: data}, {transition: {duration: 1000, easing: 'cubic-in-out' }});
	}
}

// This function plots a custom legend for grouped data on the color axis
function customLegend(mNames, mColors){
  var legendID = document.getElementById("customLegend-modal");

  if (mNames != null){
    //console.log("Turning custom legend on.");
    // Make HTML for legend
    var htmlBlock = "<b>Color</b></br>";
    for (i = 0; i < mNames.length; i++){
      // Create each HTML entry
      var entry = "<span style='color:" + mColors[i] + "'>&#x25cf;</span> - " + mNames[i] + "</br>";
      htmlBlock += entry;
    }
    legendID.innerHTML = htmlBlock;
    legendID.style.display='block';
  } else {
    //console.log("Turning custom legend off.");
    legendID.innerHTMl = "";
    legendID.style.display='none';
  }
}

function getColorListFromNameList(mNames){
  numColors = mNames.length;
  var colorList = [];
  for (i = 0; i < numColors; i++){
    var color = "hsl(0, 0%, 86%)"; // default gray for N/A values
    switch(mNames[i]){
      case "na": case "NA": case "n/a": case "N/A":
        break;
      default:
      // Get color from HSL color space, looping with modulo operation (%)
      var numHues = 50;
      var minBrightness = 40;
      var maxBrightness = 80;
      color = "hsl(" + Math.floor(500*(i%numHues)/Math.min(numColors,numHues)) + ", 90%, " + Math.floor(minBrightness+(maxBrightness-minBrightness)*(i/numColors)) + "%)";
    }
    colorList.push(color);
  }
  return colorList;
}

// Helper function to create unique arrays
function uniq(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

// Convert Google chart column to Plotly array
function columnToArray(columnIndex){
  var outputArray = new Array(view.getNumberOfRows());
  for (i=0; i<view.getNumberOfRows(); i++){
    outputArray[i] = (view.getValue(i, columnIndex));
  }
  return outputArray;
}

function switch2D(){
  reDraw = true;
  twoD = !twoD;
  zDiv.hidden = twoD;
  filterGraphButton.disabled = !twoD;
  drawBubbleChart();
}

function setAxisSize(){
  var sizeAxisGroup = document.getElementById('sizeAxisGroup').cloneNode(true);

  var circ1 = document.getElementById('sizeAxisMinCirc');
  var circ2 = document.getElementById('sizeAxisMaxCirc');
  var tri   = document.getElementById('sizeAxisTriangle');

  var boxWidth = document.documentElement.clientWidth - 30;
  var xStart = 10;
  var xEnd = xStart + boxWidth;

  var textLength = 30;
  var offset = 6;

  var exampleText = document.querySelector('text.xtitle');
  var fontSize = "14px";
  if (exampleText != null){
    fontSize = exampleText.style.fontSize;
  }

  // set text locations
  sizeTitle.setAttribute('x', xStart);
  minSizeText.setAttribute('x', xStart+textLength);
  maxSizeText.setAttribute('x', xEnd-textLength);

  // Set text sizes
  sizeTitle.setAttribute('font-size', fontSize);
  sizeTitle.setAttribute('font-weight', 'bold');
  minSizeText.setAttribute('font-size', fontSize);
  maxSizeText.setAttribute('font-size', fontSize);

  // Set shape locations
  circ1.setAttribute('cx', xStart + textLength + offset + 2);
  circ2.setAttribute('cx', xEnd - textLength - offset - 7);

  var triPoints = (xStart + textLength + 2*offset + 4) + ',35 ' + (xEnd-textLength-2*offset-14) +',41 ' + (xEnd-textLength-2*offset-14) + ',29';
  tri.setAttribute('points', triPoints);

  var pressureBar = document.getElementById('pressureBar');
  var pressureIndicatorText = document.getElementById('pressureOverlay');

  pressureBar.setAttribute('style', "margin:auto; font-size: " + fontSize + ";");
  var indicatorFontSize = (Number(fontSize.substring(0, fontSize.length - 2)) +3);
  pressureIndicatorText.setAttribute('style', "font-size: " + indicatorFontSize + "; width: 3.7em; display: inline-block;");

}

function getColumns(xValue, yValue, cValue, sValue, zValue){

    var labels = 0;
    var x = getColumnFromSelectorValue(xValue);
    var y = getColumnFromSelectorValue(yValue);
    var c = getColumnFromSelectorValue(cValue);
    var s = getColumnFromSelectorValue(sValue);
    var z = getColumnFromSelectorValue(zValue);

    return cols = [labels, x, y, c, s, z];
}

function getColumnFromSelectorValue(selectorValue){
  // This function needs to convert from a select value to a dataaset column
  var column = null;

  // This logic will all need to change, as explained above.
  if (selectorValue < 23){
    column = selectorValue;
  } else if (selectorValue < 32){
    // selector, 200bar, 500bar, 900bar
    // 23: 23, 24, 25
    // 24: 26, 27, 28
    // 25: 29, 30, 31
    var pressureOffset = coarseSliderValue;
    var startColumn = (selectorValue - 23) * 3 + 23;
    column = startColumn + pressureOffset;
  }

  return column;
}

function isNumericalParameter(selectorValue){
  // numerical parameters in selector values 5-13, 15-16, 23-25
  return (selectorValue >= 5 && selectorValue <= 13) ||
    (selectorValue >= 15 && selectorValue <= 16) ||
    (selectorValue >= 23);
}

function selectChange(){
  reDraw = true;
  oldSliderValue = 100;
  onSliderUpdate();
}

function onSliderUpdate(){
  // Slider varies between 0 and 1.
  coarseSliderValue = Math.round(slider.value * 2);
  if (coarseSliderValue != oldSliderValue){
    oldSliderValue = coarseSliderValue;
    drawBubbleChart();
  }
}

// FILTER AND SEARCH
// Table filter
var oldColumns = [];
function openFilterWindow(){
  // Set columns of data table to match graph
  var xValue = parseInt(xSelector.value); var yValue = parseInt(ySelector.value);
  var cValue = parseInt(colorSelector.value); var sValue = parseInt(sizeSelector.value);
  var zValue = parseInt(zSelector.value);

  currentColumns = getColumns(xValue, yValue, cValue, sValue, zValue);
  if (oldColumns.toString() != currentColumns.toString()){
    tableView.setColumns(currentColumns);
    dash.draw(tableView);
  }
  oldcolumns = currentColumns;

  // Set rows of filter
  if (filterRows.length == allRows.length){
    filterView.setRows([]);
  }else{
    filterView.setRows(filterRows);
  }

  // Draw the filtered table with just the name column
  filterView.setColumns([0]);
  filterTable.draw(filterView);

  // Finally, show the modal box
  document.getElementById('filter-modal').style.display='block';
}

function applyFilter(){
  document.getElementById('filter-modal').style.display='none';
  drawBubbleChart();
}

function tableSelectAll(){
  filterRows = allRows;
  table.getChart().setSelection(selectAllArray);
}

function tableSelectNone(){
  // Empty filter means plot all points on graph
  filterRows = [];

  // But show no points in filter column
  filterView.setRows([]);
  filterTable.draw(filterView);
}

function addToSelection(){
  // Get selection from chart
  var selection = table.getChart().getSelection();

  // Add selection to filtered rows
  for (i=0; i<selection.length; i++){
    if (filterRows.indexOf(selection[i].row)<0){
      filterRows.push( table.getDataTable().getTableRowIndex(selection[i].row) );
    }
  }

  // Update filter table
  filterView.setRows(filterRows);
  filterTable.draw(filterView);

  // Unselect rows in main data table
  table.getChart().setSelection([]);
}

function removeFromSelection(){
  // Grab selection in filter table.
  var filterSelection = filterTable.getSelection();

  // And remove it from filtered rows
  for (i=0; i<filterSelection.length; i++){
    filterRows.splice(filterSelection[i].row, 1);
  }

  // Update filter table
  filterView.setRows(filterRows);
  filterTable.draw(filterView);
}

// Graph selection
function selectFromGraph(){
  gettingPointsFromGraph = true;
  graphFilterView.setColumns([0]);
  graphFilterView.setRows(filterRows);
  graphFilterTable.draw(graphFilterView);
  document.getElementById("graph-filter-modal").style.display = "block";
  document.getElementById('filter-modal').style.display='none';
}

function removeFromGraphSelection(){
  var filterSelection = graphFilterTable.getSelection();
  for (i=0; i<filterSelection.length; i++){
    filterRows.splice(filterSelection[i].row, 1);
  }
    graphFilterView.setRows(filterRows);
    graphFilterTable.draw(graphFilterView);
}

function applyGraphSelection(){
  document.getElementById('graph-filter-modal').style.display='none';
  gettingPointsFromGraph = false;
  drawBubbleChart();
}

// Clicking on a point
function pointSelected(data){
  if (!relaying){
    globalData = data; // debug purposes.
    var selectedPoint = data.points[0].pointNumber;
    var pointIndex = view.getTableRowIndex(selectedPoint);

    if (gettingPointsFromGraph){
      currentSelection = null;
      // For filtering: add point to filtered rows array
      if (filterRows.indexOf(pointIndex)<0){
        filterRows.push(pointIndex);
        graphFilterView.setRows(filterRows);
        graphFilterTable.draw(graphFilterView);
      }
    } else {
      // For annotation: select point for annotation
      if (pointIndex == currentSelection){
        currentSelection = null;
      }else{
        currentSelection = pointIndex;
      }
      drawBubbleChart();
    }
  } else {
    relaying = false;
  }
}

// PLAYBACK
var playing = false;
function playButtonClick(){
  buttonHandle = document.getElementById('playButton');
  if (!playing){
    playing=true;
    buttonHandle.value = 'pause';
    playSequence();
  } else {
    playing=false;
    buttonHandle.value = 'play_arrow';
  }
}

function playSequence(){
  warningBox = document.getElementById('warningText');
  if (playing){
    // Animation can be slow with over 500 points: display warning
    if (twoD && filterRows.length == 0 || filterRows.length > 500){
      warningBox.innerHTML = "Animating more than 500 data points may be slow. Try filtering the data!";
    } else {
      warningBox.innerHTML = "";
    }

    if(slider.value<1){
      // Move slider automatically
      slider.value = (parseFloat(slider.value) + 0.006).toString();
      setTimeout(playSequence, 30);
    }else{
      // Reset if we've reached the end of the slider
      slider.value = "0";
      setTimeout(playSequence, 500);
    }
    onSliderUpdate();
  } else {
    // Remove warning message if we're not playing
    warningBox.innerHTML = "";
  }
}

// RESIZE
window.addEventListener('resize', debounce(windowResizeFunction, 200));

function windowResizeFunction(){
  switch(document.getElementById('filter-modal').style.display){
    case '':
    case 'none':
      reDraw = true;
      drawBubbleChart();
      break;
    case 'block':
      document.getElementById('graph-filter-modal').style.display='none';
  }
}

// GENERIC DEBOUNCE FUNCTION
function debounce(func, wait, immediate) {
  // Debounce function from https://john-dugan.com/javascript-debounce/
    var timeout;
    return function() {
        var context = this,
            args = arguments;
        var later = function() {
            timeout = null;
            if ( !immediate ) {
                func.apply(context, args);
            }
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait || 200);
        if ( callNow ) {
            func.apply(context, args);
        }
    };
}
