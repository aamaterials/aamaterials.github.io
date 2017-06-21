google.charts.load("current", {'packages':["corechart", "table", "controls"]});
google.charts.setOnLoadCallback(init);

// 1. Create data table
var dataTable, chart, options;
var table, view;
var tableView, filterView;
var slider, colorSelector, sizeSelector, xSelect, ySelect;
var pressureOverlay;
var minSizeText; var maxSizeText; var sizeTitle;
var coarseSliderValue; var oldSliderValue = 5;
var filterRows = [];
var allRows = []; selectAllArray = [];
var allowPointSelection = false;
var sizeAxisGroup = null;

function init(){
  pressureList = [1, 5, 10, 20, 30, 50, 80, 100, 140, 200];
  pressureOverlay = document.getElementById('pressureOverlay');

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

  minSizeText = document.getElementById('sizeAxisMinText');
  maxSizeText = document.getElementById('sizeAxisMaxText');
  sizeTitle = document.getElementById('sizeAxisTitle');

  axesLabels = ['Density, g/cm\u00B3', 'Pore Limiting Diameter, \u212B', 'Largest Cavity Diameter, \u212B',
                  'Volumetric Surface Area, m\u00B2/cm\u00B3', 'Gravimetric Surface Area, m\u00b2/g', 'Void Fraction',
                'Uptake, mol/kg', 'Uptake, cm\u00B3(STP)/cm\u00B3', 'Gravimetric Deliverable Capacity, mol/kg',
              'Volumetric Deliverable Capacity, cm\u00B3(STP)/cm\u00B3', 'Heat of Adsorption, kJ/mol'];

  options = {
          title: 'Color axis',
          titleTextStyle: {bold:false, italic:true},
          colorAxis: {colors: ['red', 'orange', 'yellow', '44ff44', 'cyan', 'blue', 'magenta'], legend: {position: 'top'}, minValue: 0},
          backgroundColor: 'transparent',
          chartArea: {backgroundColor: { fill: '#fff'}},
          sizeAxis: {minValue: 0, minSize: 2, maxSize: 7},
          explorer: {keepInBounds: true, maxZoomOut: 1, maxZoomIn: 100, actions: ['dragToZoom', 'rightClickToReset'] },
          hAxis: {viewWindow: {min: 0, max: 28}, title: 'Uptake, mol/kg'},
          vAxis: {viewWindow: {min: 0, max: 320}, title: 'Uptake, cm\u00B3(STP)/cm\u00B3'},
          animation: {duration: 1000},
          crosshair: {trigger: 'focus', opacity: 0.5,  selected: {opacity: 1}},
          bubble: {textStyle: {color: 'none'}}
        };

  // Check data isn't in browser already
  var dataString = localStorage.getItem('mofdata');

  if (dataString == null){
    var rangeString = encodeURIComponent('range=A:AQ');

    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/1BXpfTXTDeg_gcDEWyjUmx_SUkWzwkZDSLilBQaabPO0/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);

  }else{
    console.log('Loading table from local storage.');
    var parsedData = JSON.parse(dataString);
    dataTable = new google.visualization.DataTable(parsedData);
  }

  // Draw initial chart
  initialiseChart();

}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AQ');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/1BXpfTXTDeg_gcDEWyjUmx_SUkWzwkZDSLilBQaabPO0/gviz/tq?gid=0&headers=1&' + rangeString);
  query.send(handleQueryResponse);
  // Close help dialog
  document.getElementById('help-modal').style.display='none';
}

function initialiseChart(){
  for (i=0; i<dataTable.getNumberOfRows(); i++){
    allRows.push(i);
    selectAllArray.push({'row': i, 'column': null});
  }

  onSliderUpdate();
  chart = new google.visualization.BubbleChart(document.getElementById('chart_div'));
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

  google.visualization.events.addListener(chart, 'select', pointSelected);
  google.visualization.events.addListener(chart, 'ready', chartReadyFunction);
  google.visualization.events.addListener(chart, 'animationfinish', chartReadyFunction);

  // Set up views
  tableView = new google.visualization.DataView(dataTable);
  filterView = new google.visualization.DataView(dataTable);
  graphFilterView = new google.visualization.DataView(dataTable);
  view = new google.visualization.DataView(dataTable);

  drawBubbleChart();
}

function chartReadyFunction(){
  options.animation.duration = 1000;
  setAxisSize(false);
  setAxisSize(true); // Strange but necessary
}

function drawBubbleChart(){
  columns = getColumns();

  var xValue = parseInt(xSelector.value); var yValue = parseInt(ySelector.value);
  var cValue = parseInt(colorSelector.value); var sValue = parseInt(sizeSelector.value);

  view.setColumns(columns);
  if (filterRows.length > 0){
    view.setRows(filterRows);
  } else {
    // Empty filter means plot all rows
    view.setRows(allRows);
  }

  options.title = axesLabels[cValue]; // Acts as the colour axis title
  options.hAxis.title = axesLabels[xValue];
  options.vAxis.title = axesLabels[yValue];

  sizeTitle.innerHTML = axesLabels[sValue];
  maxSizeText.innerHTML = view.getColumnRange(4).max.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  minSizeText.innerHTML = view.getColumnRange(4).min.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");

  options.hAxis.viewWindow.max = (xValue == 6) ? 28 : (xValue == 7) ? 320 : (xValue == 8) ? 28 : (xValue == 9) ? 320 : 'auto';
  options.vAxis.viewWindow.max = (yValue == 6) ? 28 : (yValue == 7) ? 320 : (yValue == 8) ? 28 : (yValue == 9) ? 320 : 'auto';
  options.colorAxis.maxValue = (cValue == 6) ? 28 : (cValue == 7) ? 320 : (cValue == 8) ? 28 : (cValue == 9) ? 320 : 'auto';
  options.sizeAxis.maxValue = (sValue == 6) ? 28 : (sValue == 7) ? 320 : (sValue == 8) ? 28 : (sValue == 9) ? 320 : 'auto';

  chart.draw(view, options);

  var pressure = pressureList[coarseSliderValue];
  pressureOverlay.innerHTML = pressure + ' bar';
}

///////////////
function handleQueryResponse(response) {
  if (response.isError()) {
    alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  // Get data, and store it in localStorage
  dataTable = response.getDataTable();
  var dataString = JSON.stringify(dataTable);
  localStorage['mofdata'] = dataString;
  console.log('Saved remote MOF data to local storage.');
}

function setAxisSize(append){
  var sizeAxisGroup = document.getElementById('sizeAxisGroup').cloneNode(true);

  var circ1 = document.getElementById('sizeAxisMinCirc');
  var circ2 = document.getElementById('sizeAxisMaxCirc');
  var tri   = document.getElementById('sizeAxisTriangle');

  var guideBox = document.querySelector('#chartHolder #chart_div div div div svg > g > g > rect');
  var boxWidth = Number(guideBox.getAttribute('width'));
  var xStart = Number(guideBox.getAttribute('x'));
  var xEnd = xStart + boxWidth;

  var textLength = 30;
  var offset = 6;

  var fontSize = document.querySelector('#chartHolder #chart_div div div div svg text').getAttribute('font-size');

  // set text locations
  sizeTitle.setAttribute('x', xStart);
  minSizeText.setAttribute('x', xStart+textLength);
  maxSizeText.setAttribute('x', xEnd-textLength);

  // Set text sizes
  sizeTitle.setAttribute('font-size', fontSize);
  minSizeText.setAttribute('font-size', fontSize);
  maxSizeText.setAttribute('font-size', fontSize);

  // Set shape locations
  circ1.setAttribute('cx', xStart + textLength + offset + 2);
  circ2.setAttribute('cx', xEnd - textLength - offset - 7);

  var triPoints = (xStart + textLength + 2*offset + 4) + ',35 ' + (xEnd-textLength-2*offset-14) +',39 ' + (xEnd-textLength-2*offset-14) + ',31';
  tri.setAttribute('points', triPoints);

}


function getColumns(){
    var xValue = parseInt(xSelector.value); var yValue = parseInt(ySelector.value);
    var cValue = parseInt(colorSelector.value); var sValue = parseInt(sizeSelector.value);

    var labels = 0;
    var x = getColumnFromSelectorValue(xValue);
    var y = getColumnFromSelectorValue(yValue);
    var c = getColumnFromSelectorValue(cValue);
    var s = getColumnFromSelectorValue(sValue);

    return cols = [labels, x, y, c, s];
}

function getColumnFromSelectorValue(selectorValue){
  var axesColumns = [33, 34, 35, 36, 37, 42];
  var column = null;

  if (selectorValue<6){
    column = axesColumns[selectorValue];
  } else if (selectorValue == 6){
    column = Math.round(2*coarseSliderValue+3);
  } else if (selectorValue == 7){
    column = Math.round(2*coarseSliderValue+4);
  } else if (selectorValue == 8){
    column = coarseSliderValue > 8.5 ? 31 : coarseSliderValue > 7.5 ? 29 : coarseSliderValue > 5.5 ? 27 : 25;
  } else if (selectorValue == 9){
    column = coarseSliderValue > 8.5 ? 32 : coarseSliderValue > 7.5 ? 30 : coarseSliderValue > 5.5 ? 28 : 26;
  } else if (selectorValue == 10){
    column = coarseSliderValue == 8 ? 24 : 23;
  }

  return column;

}

function selectChange(){
  oldSliderValue = 100;
  onSliderUpdate();
}

function onSliderUpdate(){
  // Slider varies between 0 and 1.
  var xValue = parseInt(xSelector.value); var yValue = parseInt(ySelector.value);
  var cValue = parseInt(colorSelector.value); var sValue = parseInt(sizeSelector.value);

  // Limit coarse slider values based on pressure points available
  if ((xValue > 9 || yValue > 9 || cValue > 9 || sValue > 9) &&
    (xValue < 10 && xValue > 7 || yValue < 10 && yValue > 7 || cValue < 10 && cValue > 7 || sValue < 10 && sValue > 7)){
      coarseSliderValue = 8; // only 140 bar data available
  } else if (xValue > 9 || yValue > 9 || cValue > 9 || sValue > 9) {
      coarseSliderValue = slider.value > 0.5 ? 8 : 1;
  } else if (xValue > 7 || yValue > 7 || cValue > 7 || sValue > 7){
      var tmpSliderValue = Math.round(slider.value * 9);
      coarseSliderValue = tmpSliderValue > 8 ? 9 : tmpSliderValue > 7 ? 8 : tmpSliderValue > 5 ? 6 : 4;
  } else {
      coarseSliderValue = Math.round(slider.value * 9);
  }

  if (coarseSliderValue != oldSliderValue){
    oldSliderValue = coarseSliderValue;
    drawBubbleChart();
  }

}

// FILTER AND SEARCH
var oldColumns = [];
function openFilterWindow(){
  // Set columns of data table to match graph
  currentColumns = getColumns();
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

function selectFromGraph(){
  allowPointSelection = true;
  graphFilterView.setColumns([0]);
  graphFilterView.setRows(filterRows);
  graphFilterTable.draw(graphFilterView);
  document.getElementById("graph-filter-modal").style.display = "block";
  document.getElementById('filter-modal').style.display='none';
}

function pointSelected(){
  if(allowPointSelection){
    var selectedPoint = chart.getSelection();
    var pointIndex = view.getTableRowIndex(selectedPoint[0].row);
    if (filterRows.indexOf(pointIndex)<0){ // this line to remove duplicates isn't working
      filterRows.push(pointIndex);
      graphFilterView.setRows(filterRows);
      graphFilterTable.draw(graphFilterView);
    }
  }
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
  drawBubbleChart();
}

function windowResizeFunction(){
  options.animation.duration = 0;
  switch(document.getElementById('filter-modal').style.display){
    case '':
    case 'none':
      drawBubbleChart();
      break;
    case 'block':
      document.getElementById('graph-filter-modal').style.display='none';
  }
}

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

window.addEventListener('resize', debounce(windowResizeFunction, 200));
