google.charts.load("current", {'packages':["corechart", "table", "controls"]});
google.charts.setOnLoadCallback(init);

// GLOBAL VARIABLES
var dataTable, chart, options;
var table, view;
var tableView, filterView;
var plotlyPlot;
var colorSelector, sizeSelector, xSelect, ySelect;
var minSizeText; var maxSizeText; var sizeTitle; var colorbartitle;
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

  plotlyPlot = document.getElementById('chart_div');

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

  axesLabels = ['Density (g/cm\u00B3)', 'Largest Cavity Diameter, \u212B', 'Gravimetric Surface Area (m\u00B2/g)', 'Void Fraction',
                'Sarin Q<sub>st</sub> (kJ/mol)', 'Sarin K<sub>H</sub> (mol/kg/Pa)', 'Soman Q<sub>st</sub> (kJ/mol)','Soman K<sub>H</sub> (mol/kg/Pa)',
                'DMMP Q<sub>st</sub> (kJ/mol)', 'DMMP K<sub>H</sub> (mol/kg/Pa)','DIFP Q<sub>st</sub> (kJ/mol)', 'DIFP K<sub>H</sub> (mol/kg/Pa)',
                'DES Q<sub>st</sub> (kJ/mol)', 'DES K<sub>H</sub> (mol/kg/Pa)', 'Mustard Q<sub>st</sub> (kJ/mol)', 'Mustard K<sub>H</sub> (mol/kg/Pa)',
                'Water Q<sub>st</sub> (kJ/mol)', 'Water K<sub>H</sub> (mol/kg/Pa)', 'Sarin Q<sub>st</sub>/Water Q<sub>st</sub>', 'Sarin K<sub>H</sub>/water K<sub>H</sub>',
                'Soman Q<sub>st</sub>/Water Q<sub>st</sub>', 'Soman K<sub>H</sub>/water K<sub>H</sub>', 'DMMP Q<sub>st</sub>/water Q<sub>st</sub>', 'DMMP K<sub>H</sub>/water K<sub>H</sub>', 'DIFP Q<sub>st</sub>/water Q<sub>st</sub>', 'DIFP K<sub>H</sub>/water K<sub>H</sub>',
                'DES Q<sub>st</sub>/Water Q<sub>st</sub>', 'DES K<sub>H</sub>/water K<sub>H</sub>', 'Mustard Q<sub>st</sub>/Water Q<sub>st</sub>', 'Mustard K<sub>H</sub>/water K<sub>H</sub>',
                'Mustard loading', 'Sarin loading (mol/kg)', 'Soman loading (mol/kg)', 'Water loading (mol/kg)'];

  //shortLabels = ['Topo.', 'Link. ID', 'MCN', 'SMod., GPa', 'BMod., GPa', 'Plan.', 'VF', 'VSA (m\u00B2/cm\u00B3)', 'GSA (m\u00B2/g)',
  //                'PLD, \u212B', 'LCD, \u212B', 'LCD/PLD', 'ACN', 'd (g/cm\u00B3)', 'GPV (cm\u00B3/g)', 'PV in UC (10\u00B3\u212B\u00B3)'];

  // Get data table from browser cache if possible
  //var dataString = localStorage.getItem('aureliamofs4');
  var db;
  var requestDB = window.indexedDB.open("CWAmof");

  requestDB.onupgradeneeded = function(event){
    db = requestDB.result;
    db.createObjectStore("cwa", {keyPath: "id"});

    var rangeString = encodeURIComponent('range=A:AQ');
    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/1BwsLzYQGg3G4InD9Zl8lbl4FZk2qZYQXj7AUuKey-tg/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);
  };

  requestDB.onsuccess = function(event){
    db = requestDB.result;
    // Get data from the database
    var request = db.transaction(["cwa"]).objectStore("cwa").get("01");

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
  //localStorage['aureliamofs4'] = dataString;
  var requestDB = window.indexedDB.open("mofDatabase");
  requestDB.onsuccess = function(event){
    db = requestDB.result;
    var request = db.transaction(["aureliamofs4"], "readwrite").objectStore("aureliamofs4").add({id: "01", data: dataString});

    request.onsuccess = function(event){console.log('Saved remote MOF data to local indexedDB.');};
    request.onerror = function(event){console.log('Failed to save data to local indexedDB. Will try loading chart anyway.');};
  };
  initialiseChart();
}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AQ');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/1lA7I4uYPsHAPUyLxbxJaZRP7b9VD-E0lVJfnDY8GxO8/gviz/tq?gid=0&headers=1&' + rangeString);
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

  //onSliderUpdate();
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
  drawBubbleChart();
  setAxisSize();
}

function drawBubbleChart(){
  setAxisSize();
  xValue = parseInt(xSelector.value);
  yValue = parseInt(ySelector.value);
  cValue = parseInt(colorSelector.value);
  sValue = parseInt(sizeSelector.value);
  zValue = parseInt(zSelector.value);

  columns = getColumns(xValue, yValue, cValue, sValue, zValue);


	layout = {
          font: {family: 'Open Sans', size: 16},
          margin: {l: 80, r: 0, t:20, b:80},

          hovermode: 'closest',

          xaxis: {title: ''},
          yaxis: {title: ''},
          scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
            aspectratio: {x: 3, y: 1, z: 1},
            camera: {}
          },
				};

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
  layout.scene.xaxis.title = axesLabels[xValue]; //.substring(3, (axesLabels[sValue].length-4));
  layout.scene.zaxis.title = axesLabels[yValue]; //.substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view
  layout.scene.yaxis.title = axesLabels[zValue]; //.substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view

  sizeTitle.innerHTML = axesLabels[sValue]; //.substring(3, (axesLabels[sValue].length-4));

  maxSizeText.innerHTML = view.getColumnRange(4).max.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  minSizeText.innerHTML = view.getColumnRange(4).min.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");

  hmax = view.getColumnRange(1).max;
  vmax = view.getColumnRange(2).max;
  zmax = view.getColumnRange(5).max;

  cmax = view.getColumnRange(3).max;
  smax = view.getColumnRange(4).max;

	drawPlotlyChart();

}

function drawPlotlyChart(){
  var trace = {
    mode: 'markers',
    text: columnToArray(0),
    x: columnToArray(1),
    hoverinfo: "text+name",
	  name: "Structure name",
    marker: {
      color: columnToArray(3),
      opacity: 0.7,
      line: {width: 1, color: '#eee'}
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

  if (xValue == 5 |xValue == 7 |xValue == 9 |xValue == 11 |xValue == 13 |xValue == 15 |
  xValue == 17 |xValue == 19 |xValue == 21 |xValue == 23 |xValue == 25 |xValue == 27 |xValue == 29){
    layout.xaxis.type='log'
  }

  if (yValue == 5 |yValue == 7 |yValue == 9 |yValue == 11 |yValue == 13 |yValue == 15 |
  yValue == 17 |yValue == 19 |yValue == 21 |yValue == 23 |yValue == 25 |yValue == 27 |yValue == 29){
    layout.yaxis.type='log'
  }

    // If we've not got colour axis set to planar type
    trace.marker.colorbar = {title: colorbarTitle, titleside: 'right'};
    trace.marker.colorscale = 'Jet';
    trace.marker.autocolorscale = false;
    trace.marker.showscale = true;

    // If we've not got size axis set to planar type
    trace.marker.size = columnToArray(4),
    trace.marker.sizeref = smax/40;
    trace.marker.sizemin = 4;

	var data = [trace];

	if (currentSelection == null){
    layout.annotations = [];
  } else {
    var viewRow = view.getViewRowIndex(currentSelection);
    var xLoc = view.getValue(viewRow, 1);
    var yLoc = view.getValue(viewRow, 2);
    if (xValue == 5){xLoc=Math.exp(xLoc)}
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

      var annoText = '<b>' + view.getValue(viewRow, 0) + '</b><br>' +
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

    layout.scene.camera = {center: {x: 0, y: 0, z: -0.1},
                    eye: {x: 0.02, y: -2.2, z: 0.1}}; // up = 0 1 0 ?
		Plotly.newPlot('chart_div', data, layout);

    // Set up events
    plotlyPlot.on('plotly_click', debounce(pointSelected, 200));
    plotlyPlot.on('plotly_relayout', function(){relaying=true;});
		reDraw = true;
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
  column = selectorValue + 1;
  return column;

}

function selectChange(){
  reDraw = true;
  drawBubbleChart();
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
