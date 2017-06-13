google.charts.load("current", {'packages':["corechart"]});
google.charts.load("upcoming", {'packages':["table"]});
google.charts.setOnLoadCallback(init);

// 1. Create data table
var dataTable, chart, options;
var table, view, selection;
var slider, colorSelector, sizeSelector, xSelect, ySelect;
var pressureOverlay;
var minSizeText; var maxSizeText; var sizeTitle;
var coarseSliderValue; var oldSliderValue = 5;
var filterRows = [];
var allRows = [];

function init(){
  pressureList = [1, 5, 10, 20, 30, 50, 80, 100, 140, 200];
  pressureOverlay = document.getElementById('pressureOverlay');

  slider = document.getElementById('slider');
  slider.addEventListener('input', sliderUpdate);

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

    // Draw initial chart
    initialiseChart();
  }

  for (i=0; i<dataTable.getNumberOfRows(); i++){
    allRows.push(i);
  }

}

function reloadMOFdata(){
  var rangeString = encodeURIComponent('range=A:AQ');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/1BXpfTXTDeg_gcDEWyjUmx_SUkWzwkZDSLilBQaabPO0/gviz/tq?gid=0&headers=1&' + rangeString);
  query.send(handleQueryResponse);
  document.getElementById('help-modal').style.display='none';

}

function initialiseChart(){
  sliderUpdate();
  table = new google.visualization.Table(document.getElementById('table_div'));
  chart = new google.visualization.BubbleChart(document.getElementById('chart_div'));

  google.visualization.events.addListener(table, 'ready', function() {
    table.setSelection(selection);
  });

  drawBubbleChart();
}

function drawBubbleChart(){
  view = new google.visualization.DataView(dataTable);

  columns = getColumns();

  var xValue = parseInt(xSelector.value); var yValue = parseInt(ySelector.value);
  var cValue = parseInt(colorSelector.value); var sValue = parseInt(sizeSelector.value);

  view.setColumns(columns);
  if (filterRows.length > 0){
    view.setRows(filterRows);
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
  setAxisSize();
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

  // Draw initial chart
  initialiseChart();

}

function setAxisSize(){
  var circ1 = document.getElementById('sizeAxisMinCirc');
  var circ2 = document.getElementById('sizeAxisMaxCirc');
  var tri   = document.getElementById('sizeAxisTriangle');

  var boxWidth = document.getElementById('sizeAxisLegend').getBoundingClientRect().width;

  minSizeText.setAttribute('x', 40);
  maxSizeText.setAttribute('x', boxWidth-40);
  circ1.setAttribute('cx', 52);
  circ2.setAttribute('cx', boxWidth-52);

  var triPoints = '65,35 ' + (boxWidth-65) +',39 ' + (boxWidth-65) + ',31';
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
  sliderUpdate();
}

function sliderUpdate(){
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

var oldColumns = [];
function openFilterWindow(){
  document.getElementById('filter-modal').style.display='block';
  currentColumns = getColumns();
  if (oldColumns.toString() != currentColumns.toString()){
    tableView = new google.visualization.DataView(dataTable);
    tableView.setColumns(currentColumns);
    table.draw(tableView);
  }
  oldcolumns = currentColumns;
}

function applyFilter(){
  filterRows = [];
  selection = table.getSelection();
  for (i=0; i<selection.length; i++){
    filterRows.push(selection[i].row);
  }
  document.getElementById('filter-modal').style.display='none';
  drawBubbleChart();
}

function tableSelectAll(){
  filterRows = allRows;
  //table.setSelection(filterRows);
}

function tableSelectNone(){
  filterRows = [];
  table.setSelection(filterRows);
}
