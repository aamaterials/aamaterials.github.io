google.charts.load("current", {'packages':["corechart", "table", "controls"]});
google.charts.setOnLoadCallback(init);

// GLOBAL VARIABLES
var dataTable, chart, options;
var table, view;
var tableView, filterView;
var plotlyPlot;
var slider, colorSelector, sizeSelector, xSelect, ySelect;
var pressureOverlay
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
  pressureList = [1, 10];
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

  axesLabels = ['<b>Identifier</b>', '<b>Density, g/cm\u00B3</b>', '<b>Largest Cavity Diameter, \u212B</b>', '<b>Gravimetric Surface Area, m\u00b2/g</b>',
                  '<b>Void Fraction</b>', '<b>Kr/N2 selectivity</b>', '<b>Kr/Ar selectivity</b>',
                   '<b>Kr/CF4 selectivity</b>', '<b>Kr, mg/g</b>',
                    '<b>N2, mg/g</b>',	'<b>Ar, mg/g</b>',	'<b>CF4, mg/g</b>',
                    '<b>Kr, g/L</b>',	'<b>N2, g/L</b>',
                    '<b>Ar, g/L</b>',	'<b>CF4, g/L</b>'
                    ];

	layout = {
          font: {family: 'Open Sans', size: 16},
          margin: {l: 80, r: 0, t:20, b:50},
          hovermode: 'closest',

          xaxis: {title: ''}, yaxis: {title: ''},
          scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
            aspectratio: {x: 3, y: 1, z: 1},
            camera: {}
          },
				};

 // Get data table from browser cache if possible
  var db;
  var requestDB = window.indexedDB.open("edwards_bis_lowt");

  requestDB.onupgradeneeded = function(event){
    console.log("upgrade needed!")
    db = requestDB.result;
    db.createObjectStore("edwards_data_bis_lowt", {keyPath: "id"});

    var rangeString = encodeURIComponent('range=A:AH');
    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/14ASHeGZF-ZRB9gJmLss-3wZqiVo9Kn8ey7eXZOzpK_c/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);
  };

  requestDB.onsuccess = function(event){
    db = requestDB.result;

    // Get data from the database
    var request = db.transaction(["edwards_data_bis_lowt"]).objectStore("edwards_data_bis_lowt").get("01");

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
  var requestDB = window.indexedDB.open("edwards_bis_lowt");
  requestDB.onsuccess = function(event){
    db = requestDB.result;
    var request = db.transaction(["edwards_data_bis_lowt"], "readwrite").objectStore("edwards_data_bis_lowt").add({id: "01", data: dataString});

    request.onsuccess = function(event){console.log('Saved remote MOF data to local indexedDB.');};
    request.onerror = function(event){console.log('Failed to save data to local indexedDB. Will try loading chart anyway.');};
  };
  initialiseChart();
}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AH');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/14ASHeGZF-ZRB9gJmLss-3wZqiVo9Kn8ey7eXZOzpK_c/gviz/tq?gid=0&headers=1&' + rangeString);
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
  graphFilterTable = new google.visualization.Table(document.getElementById('graph-filterTable_div'))

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

  // Draw first chart
  // drawBubbleChart();
  // setAxisSize();
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
  layout.scene.xaxis.title = axesLabels[xValue].substring(3, (axesLabels[sValue].length-4));
  layout.scene.zaxis.title = axesLabels[yValue].substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view
  layout.scene.yaxis.title = axesLabels[zValue].substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view

  sizeTitle.innerHTML = axesLabels[sValue].substring(3, (axesLabels[sValue].length-4));
  maxSizeText.innerHTML = view.getColumnRange(4).max.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  minSizeText.innerHTML = view.getColumnRange(4).min.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");
 

  hmax = view.getColumnRange(1).max;
  vmax = view.getColumnRange(2).max;
  zmax = view.getColumnRange(5).max;

  cmax = view.getColumnRange(3).max;
  smax = view.getColumnRange(4).max;

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
      sizeref: smax/40,
      sizemin: 4,
      line: {width: 1},
      color: columnToArray(3),
      colorbar: {title: colorbarTitle, titleside: 'right'},
      //cmin: 0,
      //cmax: cmax,
      colorscale: 'Viridis',
      autocolorscale: false,
      showscale: true,
      opacity: 0.7
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
      var annoText = '<b>' + view.getValue(viewRow, 0) + '</b><br>' +
        layout.xaxis.title + ': ' + view.getValue(viewRow, 1).toPrecision(4) + '<br>' +
        layout.yaxis.title + ': ' + view.getValue(viewRow, 2).toPrecision(4) + '<br>' +
        colorbarTitle + ': ' + view.getValue(viewRow, 3).toPrecision(4) + '<br>' +
        sizeTitle.innerHTML + ': ' + view.getValue(viewRow, 4).toPrecision(4) + '<br>';
      layout.annotations = [{x: xLoc, y: yLoc, text: annoText, showarrow: true,
        arrowhead: 7, arrowsize:1, arrowwidth:2, ax: 140, ay: 10, align: 'right',
        xref: 'x', yref: 'y', bgcolor: '#666666', opacity: 0.8, font: {color: 'white'}}];
      }
  }

	if(reDraw){
    //layout.xaxis.range = [0, hmax];
    //layout.yaxis.range = [0, vmax];
    //layout.scene.xaxis.range = [0, hmax];
  	//layout.scene.zaxis.range = [0, vmax]; // Note z is vertical axis in 3D view
    //layout.scene.yaxis.range = [0, zmax];

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

// GET DATA TABLE
//function handleQueryResponse(response) {
//  if (response.isError()) {
//    alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
//    return;
//  }

  // Get data, and store it in localStorage
//  dataTable = response.getDataTable();
//  var dataString = JSON.stringify(dataTable);
//  localStorage['edwards'] = dataString;
//  console.log('Saved remote MOF data to local storage.');
//  initialiseChart();
//}

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
  var yMid = 40;

  var exampleText = document.querySelector('text.xtitle');
  var fontSize = "19px";
  if (exampleText != null){
    fontSize = exampleText.style.fontSize;
  }

  // set text locations
  sizeTitle.setAttribute('x', xStart);
  sizeTitle.setAttribute('y', yMid-20);
  minSizeText.setAttribute('x', xStart+textLength);
  maxSizeText.setAttribute('x', xEnd-textLength);
  minSizeText.setAttribute('y', yMid+7);
  maxSizeText.setAttribute('y', yMid+7);

  // Set text sizes
  sizeTitle.setAttribute('font-size', fontSize);
  sizeTitle.setAttribute('font-weight', 'bold');
  minSizeText.setAttribute('font-size', fontSize);
  maxSizeText.setAttribute('font-size', fontSize);

  // Set shape locations
  circ1.setAttribute('cx', xStart + textLength + offset + 2);
  circ2.setAttribute('cx', xEnd - textLength - offset - 7);
  circ1.setAttribute('cy', yMid);
  circ2.setAttribute('cy', yMid);


  var triPoints = (xStart + textLength + 2*offset + 4) + ',' + (yMid) + ' ' + (xEnd-textLength-2*offset-14) +',' + (yMid+6) + ' ' + (xEnd-textLength-2*offset-14) + ',' + (yMid-6);
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
  var column = null;
  
  // This logic will all need to change, as explained above.
  if (selectorValue < 5){
    column = selectorValue;
  } else if (selectorValue < 27){
    // selector, 1bar, 10bar
    // 5: 5, 6
    // 7: 7, 8
    // 9: 9, 10
    var pressureOffset = coarseSliderValue;
    var startColumn = (selectorValue - 5) * 2 + 5;
    column = startColumn + pressureOffset;
  }

  return column;

}

function selectChange(){
  reDraw = true;
  drawBubbleChart();
}

function onSliderUpdate(){
  // Slider varies between 0 and 1.
  coarseSliderValue = Math.round(slider.value);
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
};