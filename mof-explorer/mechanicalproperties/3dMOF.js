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

  axesLabels = ['Topology', 'Linker ID', 'Maximum Coordination Number', 'Shear Modulus, GPa', 'Bulk Modulus, GPa', 'Planarity', 'Void Fraction', 'Volumetric Surface Area (m\u00B2/cm\u00B3)',
                'Gravimetric Surface Area (m\u00B2/g)', 'Pore Limiting Diameter, \u212B','Largest Cavity Diameter, \u212B', 'LCD/PLD', 'Average Coordination Number', 'Density (g/cm\u00B3)', 'Gravimetric Pore Volume (cm\u00B3/g)'];

  shortLabels = ['Topo.', 'Link. ID', 'MCN', 'SMod., GPa', 'BMod., GPa', 'Plan.', 'VF', 'VSA (m\u00B2/cm\u00B3)', 'GSA (m\u00B2/g)', 
                  'PLD, \u212B', 'LCD, \u212B', 'LCD/PLD', 'ACN', 'd (g/cm\u00B3)', 'GPV (cm\u00B3/g)'];

  // Get data table from browser cache if possible
  var dataString = localStorage.getItem('aureliamofs3');

  if (dataString == null){
    // Download data table if necessary
    var rangeString = encodeURIComponent('range=A:AQ');

    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/12mcbJvr1ygncGSc6TEOHaBqcJRPRMi8S7pwtqynlnSw/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);

  }else{
    console.log('Loading table from local storage.');
    var parsedData = JSON.parse(dataString);
    dataTable = new google.visualization.DataTable(parsedData);
    // Draw initial chart
    initialiseChart();
  }

}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AQ');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/12mcbJvr1ygncGSc6TEOHaBqcJRPRMi8S7pwtqynlnSw/gviz/tq?gid=0&headers=1&' + rangeString);
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

  setAxisSize();
  xValue = parseInt(xSelector.value);
  yValue = parseInt(ySelector.value);
  cValue = parseInt(colorSelector.value);
  sValue = parseInt(sizeSelector.value);
  zValue = parseInt(zSelector.value);

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
  layout.scene.xaxis.title = axesLabels[xValue]; //.substring(3, (axesLabels[sValue].length-4));
  layout.scene.zaxis.title = axesLabels[yValue]; //.substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view
  layout.scene.yaxis.title = axesLabels[zValue]; //.substring(3, (axesLabels[sValue].length-4)); // Note z is vertical axis in 3D view

  sizeTitle.innerHTML = axesLabels[sValue]; //.substring(3, (axesLabels[sValue].length-4));

  if (sValue != 0 && sValue != 1 && sValue != 5){
    maxSizeText.innerHTML = view.getColumnRange(4).max.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
    minSizeText.innerHTML = view.getColumnRange(4).min.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");
  } else {
    maxSizeText.innerHTML = 'n/a';
    minSizeText.innerHTML = 'n/a';
  }

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

  if (cValue != 0 && cValue != 1 && cValue != 5){
    // If we've not got colour axis set to planar type
    trace.marker.colorbar = {title: colorbarTitle, titleside: 'right'};
    trace.marker.colorscale = 'Jet';
    trace.marker.autocolorscale = false;
    trace.marker.showscale = true;
  } else {
	trace.marker.showscale = false;
    trace.showlegend = false;
	layout.showlegend = true; 
  }
  //if color is set to Planarity
  if (cValue == 5){
    var markerNamesPlanarity = columnToArray(3);
    var markerColors = new Array(markerNamesPlanarity.length);
    for (i=0; i<markerNamesPlanarity.length; i++){
      switch(markerNamesPlanarity[i]){
          case "Planar 3-coordinated":
              markerColors[i]= "rgb(255, 0, 0)"; break;
          case "Planar 3,4-coordinated":
              markerColors[i] = "rgb(255, 154, 0)";break;
		  case "Planar 4-coordinated":
              markerColors[i]= "rgb(255, 230, 0)"; break;
		  case "Planar 4,6-coordinated":
              markerColors[i]= "rgb(154, 255, 0)"; break;
          case "Non Planar":
              markerColors[i] ="rgb(0, 7, 255)"; break;
       }
   }
   //trace.showlegend = true;
   trace.marker.color = markerColors;
   trace.text = columnToArray(3);
   trace.name = "Planarity";
  }
  
  //if color is set to Linker ID
  if (cValue == 1){
    var markerNamesLinker = columnToArray(3);
    var markerColors = new Array(markerNamesLinker.length);
    for (i=0; i<markerNamesLinker.length; i++){
      switch(markerNamesLinker[i]){
          case 1:
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case 2:
              markerColors[i] = "rgb(255, 140, 0)";break;
		  case 3:
              markerColors[i]= "rgb(255, 215, 0)"; break;
		  case 4:
              markerColors[i]= "rgb(255, 255, 0)"; break;
          case 5:
              markerColors[i] ="rgb(154, 205, 50)"; break;
          case 6:
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case 7:
              markerColors[i] = "rgb(32, 178, 170)";break;
		  case 8:
              markerColors[i]= "rgb(47, 79, 79)"; break;
		  case 9:
              markerColors[i]= "rgb(0, 206, 209)"; break;
          case 10:
              markerColors[i] ="rgb(0, 191, 255)"; break;
          case 11:
              markerColors[i]= "rgb(0, 0, 128)"; break;
          case 12:
              markerColors[i] = "rgb(148, 0, 211)";break;
		  case 13:
              markerColors[i]= "rgb(199, 21, 147)"; break;
		  case 14:
              markerColors[i]= "rgb(255, 105, 180)"; break;		  
       }
   }
   trace.marker.color = markerColors;
   trace.text = columnToArray(3);
   trace.name = "Linker ID";
  } 
  
  //if color is set to Topology
 if (cValue == 0){
    var markerNamesTopo = columnToArray(3);
    var markerColors = new Array(markerNamesTopo.length);
    for (i=0; i<markerNamesTopo.length; i++){
      switch(markerNamesTopo[i]){
          case "acs":
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case "bcs":
              markerColors[i] = "rgb(220, 20, 60)";break;
		  case "bct":
              markerColors[i]= "rgb(205, 92, 92)"; break;
		  case "bcu":
              markerColors[i]= "rgb(240, 128, 128)"; break;
          case "bor":
              markerColors[i] ="rgb(255, 140, 0)"; break;
          case "crs":
              markerColors[i]= "rgb(255, 215, 0)"; break;
          case "csq":
              markerColors[i] = "rgb(218, 165, 32)";break;
		  case "ctn":
              markerColors[i]= "rgb(255, 255, 0)"; break;
		  case "dia":
              markerColors[i]= "rgb(154, 205, 50)"; break;
          case "fcu":
              markerColors[i] ="rgb(107, 142, 35)"; break;
          case "flu":
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case "ftw":
              markerColors[i] = "rgb(34, 139, 34)";break;
		  case "gar":
              markerColors[i]= "rgb(50, 205, 50)"; break;
		  case "iac":
              markerColors[i]= "rgb(46, 139, 87)"; break;	
          case "ith":
              markerColors[i]= "rgb(102, 205, 170)"; break;
          case "lcs":
              markerColors[i] = "rgb(60, 179, 113)";break;
		  case "lvt":
              markerColors[i]= "rgb(32, 178, 170)"; break;
		  case "nbo":
              markerColors[i]= "rgb(47, 79, 79)"; break;
          case "nia":
              markerColors[i] ="rgb(0, 128, 128)"; break;
          case "ocu":
              markerColors[i]= "rgb(0, 255, 255)"; break;
          case "pcu":
              markerColors[i] = "rgb(0, 206, 209)";break;
		  case "pth":
              markerColors[i]= "rgb(64, 224, 208)"; break;
		  case "pto":
              markerColors[i]= "rgb(127, 255, 212)"; break;
          case "pts":
              markerColors[i] ="rgb(176, 224, 230)"; break;
          case "pyr":
              markerColors[i]= "rgb(95, 158, 160)"; break;
          case "qtz":
              markerColors[i] = "rgb(70, 130, 180)";break;
		  case "reo":
              markerColors[i]= "rgb(0, 191, 255)"; break;
		  case "rhr":
              markerColors[i]= "rgb(30, 144, 255)"; break;
          case "rht":
              markerColors[i]= "rgb(25, 25, 112)"; break;
          case "scu":
              markerColors[i] = "rgb(0, 10, 139)";break;
		  case "she":
              markerColors[i]= "rgb(0, 0, 255)"; break;
		  case "soc":
              markerColors[i]= "rgb(138, 43, 226)"; break;
          case "sod":
              markerColors[i] ="rgb(75, 0, 130)"; break;
          case "spn":
              markerColors[i]= "rgb(139, 0, 139)"; break;
          case "srs":
              markerColors[i] = "rgb(148, 0, 211)";break;
		  case "ssa":
              markerColors[i]= "rgb(186, 85, 211)"; break;
		  case "ssb":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "stp":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "tbo":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "the":
              markerColors[i] = "rgb(255, 20, 147)";break;
		  case "tpt":
              markerColors[i]= "rgb(255, 182, 193)"; break;		  
       }
   }
   trace.marker.color = markerColors;
   trace.text = columnToArray(3);
   trace.name = "Topology";
  }  

  if (sValue != 0 && sValue != 1 && sValue != 5){
    // If we've not got size axis set to planar type
    trace.marker.size = columnToArray(4),
    trace.marker.sizeref = smax/40;
    trace.marker.sizemin = 4;
  }  
	var data = [trace];

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

function getShapes(){
  // This one, specific to Aurelia's data, sets the symbol based on the planarity
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
function handleQueryResponse(response) {
  if (response.isError()) {
    alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  // Get data, and store it in localStorage
  dataTable = response.getDataTable();
  var dataString = JSON.stringify(dataTable);
  localStorage['aureliamofs3'] = dataString;
  console.log('Saved remote MOF data to local storage.');
  initialiseChart();
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
