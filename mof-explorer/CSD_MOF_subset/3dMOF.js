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

  axesLabels = ['Years', 'Family', 'Largest Cavity Diameter, \u212B', 'Pore Limiting Diameter, \u212B', 'Density, g/cm\u00B3', 'Volumetric Accessible Surface Area, m\u00B2/cm\u00B3',
  'Gravimetric Accesible Surface Area, m\u00B2/g', 'Metal 1', 'Metal 2', 'Functional Group', 'Channel Dimension','SQUEEZEd?','In Chiral Space Groups', 'Contains Chiral Atoms', 'R factor, %',
  'Crystal Systems', 'Space Group', 'Void Fraction'];

  shortLabels = ['Y', 'Fam', 'LCD, \u212B', 'PLD, \u212B', 'd, g/cm\u00B3 ', 'VASA, m\u00B2/cm\u00B3', 'GASA, m\u00B2/g',
                  'M1', 'M2', 'FG', 'Chan Dim', 'SQ', 'Chir SP', 'Chir At', 'R', 'CS', 'SG', 'VF'];

  // Get data table from browser cache if possible
  //var dataString = localStorage.getItem('aureliamofs4');
  var db;
  var requestDB = window.indexedDB.open("camMofDatabase");

  requestDB.onupgradeneeded = function(event){
    db = requestDB.result;
    db.createObjectStore("cam", {keyPath: "id"});

    var rangeString = encodeURIComponent('range=A:AQ');
    var query = new google.visualization.Query(
      'https://docs.google.com/spreadsheets/d/1MjaGnDg-w7TBeZ7LnU6S2KwcPQRh_X_blGlw1jZACqI/gviz/tq?gid=0&headers=1&' + rangeString);
    query.send(handleQueryResponse);
  };

  requestDB.onsuccess = function(event){
    db = requestDB.result;
    // Get data from the database
    var request = db.transaction(["cam"]).objectStore("cam").get("01");

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
  //localStorage['camMOF'] = dataString;
  var requestDB = window.indexedDB.open("camMofDatabase");
  requestDB.onsuccess = function(event){
    db = requestDB.result;
    var request = db.transaction(["cam"], "readwrite").objectStore("cam").add({id: "01", data: dataString});

    request.onsuccess = function(event){console.log('Saved remote MOF data to local indexedDB.');};
    request.onerror = function(event){console.log('Failed to save data to local indexedDB. Will try loading chart anyway.');};
  };
  initialiseChart();
}

function reloadMOFdata(){
  // Set up query
  var rangeString = encodeURIComponent('range=A:AQ');
  var query = new google.visualization.Query(
    'https://docs.google.com/spreadsheets/d/1MjaGnDg-w7TBeZ7LnU6S2KwcPQRh_X_blGlw1jZACqI/gviz/tq?gid=0&headers=1&' + rangeString);
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

  if (yValue == 9 | yValue == 15){
    layout = {
          font: {family: 'Open Sans', size: 16},
          margin: {l: 140, r: 0, t:20, b:100},

          hovermode: 'closest',

          xaxis: {title: ''},
          yaxis: {title: ''},
          scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
            aspectratio: {x: 3, y: 1, z: 1},
            camera: {}
          },
				}
    }else if (yValue == 16 | yValue == 11  | yValue == 13){layout = {
          font: {family: 'Open Sans', size: 16},
          margin: {l: 120, r: 0, t:20, b:100},

          hovermode: 'closest',

          xaxis: {title: ''},
          yaxis: {title: ''},
          scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
            aspectratio: {x: 3, y: 1, z: 1},
            camera: {}
          },
				}
    }else if (yValue == 12){
      layout = {
            font: {family: 'Open Sans', size: 16},
            margin: {l: 220, r: 0, t:20, b:100},

            hovermode: 'closest',

            xaxis: {title: ''},
            yaxis: {title: ''},
            scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
              aspectratio: {x: 3, y: 1, z: 1},
              camera: {}
            },
          }
    }else{
      layout = {
              font: {family: 'Open Sans', size: 16},
              margin: {l: 80, r: 0, t:20, b:100},

              hovermode: 'closest',

              xaxis: {title: ''},
              yaxis: {title: ''},
              scene: {xaxis: {title: ''}, yaxis: {title: ''}, zaxis: {title: ''},
                aspectratio: {x: 3, y: 1, z: 1},
                camera: {}
              },
    				}
      }

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
      opacity: 0.5,
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


  if (cValue != 1 && cValue != 7 && cValue != 8 && cValue != 9 && cValue != 10
      && cValue != 11 && cValue != 12 && cValue != 13 && cValue != 15 && cValue != 16){
      trace.marker.colorbar = {title: colorbarTitle, titleside: 'right'};
      trace.marker.colorscale = 'Jet';
      trace.marker.autocolorscale = false;
      trace.marker.showscale = true;
  } else {
  	trace.marker.showscale = false;
    trace.showlegend = false;
  	layout.showlegend = true;
  }

  trace.marker.size = columnToArray(4),
  trace.marker.sizeref = smax/40;
  trace.marker.sizemin = 4;
  var markerNames = null;
  var markerColors = null;

  if (cValue == 1){
      markerNames = columnToArray(3);
      markerColors = new Array(markerNames.length);
      for (i=0; i<markerNames.length; i++){
        switch(markerNames[i]){
            case "ZnO":
                markerColors[i]= "rgb(255, 0, 0)"; break;
            case "ZrO":
                markerColors[i] = "rgb(255, 154, 0)";break;
  		      case "CuCu":
                markerColors[i]= "rgb(255, 230, 0)"; break;
  		      case "ZIF":
                markerColors[i]= "rgb(154, 255, 0)"; break;
            case "CPO27":
                markerColors[i]= "rgb(154, 0, 255)"; break;
            case "IRMOF":
                markerColors[i]= "rgb(0, 154, 255)"; break;
            case "FMOF":
                markerColors[i]= "rgb(154, 154, 255)"; break;
            case "NA":
                markerColors[i]= "rgb(220, 220, 220)"; break;
         }
     }
       //trace.showlegend = true;
       trace.marker.color = markerColors;
       trace.text = columnToArray(3);
       trace.name = "Family";
  }

  if (cValue == 7){
      markerNames = columnToArray(3);
      markerColors = new Array(markerNames.length);
      for (i=0; i<markerNames.length; i++){
        switch(markerNames[i]){
            case "Ag":
              markerColors[i]= "rgb(139, 0, 0)"; break;
            case "Al":
              markerColors[i] = "rgb(220, 20, 60)";break;
		        case "Au":
              markerColors[i]= "rgb(205, 92, 92)"; break;
		        case "Ba":
              markerColors[i]= "rgb(240, 128, 128)"; break;
            case "Be":
              markerColors[i] ="rgb(255, 140, 0)"; break;
            case "Bi":
              markerColors[i]= "rgb(255, 215, 0)"; break;
            case "Ca":
              markerColors[i] = "rgb(218, 165, 32)";break;
		        case "Cd":
              markerColors[i]= "rgb(255, 255, 0)"; break;
		        case "Ce":
              markerColors[i]= "rgb(154, 205, 50)"; break;
            case "Co":
              markerColors[i] ="rgb(107, 142, 35)"; break;
            case "Cr":
              markerColors[i]= "rgb(0, 100, 0)"; break;
            case "Cs":
              markerColors[i] = "rgb(34, 139, 34)";break;
		        case "Cu":
              markerColors[i]= "rgb(50, 205, 50)"; break;
		        case "Dy":
              markerColors[i]= "rgb(46, 139, 87)"; break;
            case "Er":
              markerColors[i]= "rgb(102, 205, 170)"; break;
            case "Eu":
              markerColors[i] = "rgb(60, 179, 113)";break;
		        case "Fe":
              markerColors[i]= "rgb(32, 178, 170)"; break;
		        case "Ga":
              markerColors[i]= "rgb(47, 79, 79)"; break;
            case "Gd":
              markerColors[i] ="rgb(0, 128, 128)"; break;
            case "Ge":
              markerColors[i]= "rgb(0, 255, 255)"; break;
            case "Hf":
              markerColors[i] = "rgb(0, 206, 209)";break;
		        case "Hg":
              markerColors[i]= "rgb(64, 224, 208)"; break;
		        case "Ho":
              markerColors[i]= "rgb(127, 255, 212)"; break;
            case "In":
              markerColors[i] ="rgb(176, 224, 230)"; break;
            case "K":
              markerColors[i]= "rgb(95, 158, 160)"; break;
            case "La":
              markerColors[i] = "rgb(70, 130, 180)";break;
		        case "Li":
              markerColors[i]= "rgb(0, 191, 255)"; break;
		        case "Lu":
              markerColors[i]= "rgb(30, 144, 255)"; break;
            case "Mg":
              markerColors[i]= "rgb(25, 25, 112)"; break;
            case "Mn":
              markerColors[i] = "rgb(0, 10, 139)";break;
  		      case "Mo":
              markerColors[i]= "rgb(0, 0, 255)"; break;
	  	      case "Na":
              markerColors[i]= "rgb(138, 43, 226)"; break;
            case "Nd":
              markerColors[i] ="rgb(75, 0, 130)"; break;
            case "Ni":
              markerColors[i]= "rgb(139, 0, 139)"; break;
            case "Np":
              markerColors[i] = "rgb(148, 0, 211)";break;
	  	      case "Os":
              markerColors[i]= "rgb(186, 85, 211)"; break;
	  	      case "Pb":
              markerColors[i]= "rgb(221, 160, 221)"; break;
            case "Pr":
              markerColors[i] ="rgb(255, 0, 255)"; break;
            case "Pt":
              markerColors[i]= "rgb(219, 112, 147)"; break;
            case "Rb":
              markerColors[i] = "rgb(255, 20, 147)";break;
		        case "Re":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "Rh":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "Ru":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Sb":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Sc":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Sm":
              markerColors[i] = "rgb(255, 20, 147)";break;
    		  case "Sn":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "Sr":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "Tb":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Th":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Ti":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Tm":
              markerColors[i] = "rgb(255, 20, 147)";break;
        	case "U":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "V":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "W":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Y":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Yb":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Zn":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "Zr":
              markerColors[i]= "rgb(255, 182, 193)"; break;
       }
   }
   //trace.showlegend = true;
   trace.marker.color = markerColors;
   trace.text = columnToArray(3);
   trace.name = "Metal 1";
  }

  if (cValue == 8){
      markerNames = columnToArray(3);
      markerColors = new Array(markerNames.length);
      for (i=0; i<markerNames.length; i++){
        switch(markerNames[i]){
          case "Ag":
            markerColors[i]= "rgb(139, 0, 0)"; break;
        case "Al":
            markerColors[i] = "rgb(220, 20, 60)";break;
        case "Au":
            markerColors[i]= "rgb(205, 92, 92)"; break;
        case "Ba":
            markerColors[i]= "rgb(240, 128, 128)"; break;
        case "Be":
            markerColors[i] ="rgb(255, 140, 0)"; break;
        case "Bi":
            markerColors[i]= "rgb(255, 215, 0)"; break;
        case "Ca":
            markerColors[i] = "rgb(218, 165, 32)";break;
        case "Cd":
            markerColors[i]= "rgb(255, 255, 0)"; break;
        case "Ce":
            markerColors[i]= "rgb(154, 205, 50)"; break;
        case "Co":
            markerColors[i] ="rgb(107, 142, 35)"; break;
        case "Cr":
            markerColors[i]= "rgb(0, 100, 0)"; break;
        case "Cs":
            markerColors[i] = "rgb(34, 139, 34)";break;
        case "Cu":
            markerColors[i]= "rgb(50, 205, 50)"; break;
        case "Dy":
            markerColors[i]= "rgb(46, 139, 87)"; break;
        case "Er":
            markerColors[i]= "rgb(102, 205, 170)"; break;
        case "Eu":
            markerColors[i] = "rgb(60, 179, 113)";break;
        case "Fe":
            markerColors[i]= "rgb(32, 178, 170)"; break;
        case "Ga":
            markerColors[i]= "rgb(47, 79, 79)"; break;
        case "Gd":
            markerColors[i] ="rgb(0, 128, 128)"; break;
        case "Ge":
            markerColors[i]= "rgb(0, 255, 255)"; break;
        case "Hf":
            markerColors[i] = "rgb(0, 206, 209)";break;
        case "Hg":
            markerColors[i]= "rgb(64, 224, 208)"; break;
        case "Ho":
            markerColors[i]= "rgb(127, 255, 212)"; break;
        case "In":
            markerColors[i] ="rgb(176, 224, 230)"; break;
        case "K":
            markerColors[i]= "rgb(95, 158, 160)"; break;
        case "La":
            markerColors[i] = "rgb(70, 130, 180)";break;
        case "Li":
            markerColors[i]= "rgb(0, 191, 255)"; break;
        case "Lu":
            markerColors[i]= "rgb(30, 144, 255)"; break;
        case "Mg":
            markerColors[i]= "rgb(25, 25, 112)"; break;
        case "Mn":
            markerColors[i] = "rgb(0, 10, 139)";break;
        case "Mo":
            markerColors[i]= "rgb(0, 0, 255)"; break;
        case "Na":
            markerColors[i]= "rgb(138, 43, 226)"; break;
        case "Nd":
            markerColors[i] ="rgb(75, 0, 130)"; break;
        case "Ni":
            markerColors[i]= "rgb(139, 0, 139)"; break;
        case "Np":
            markerColors[i] = "rgb(148, 0, 211)";break;
        case "Os":
            markerColors[i]= "rgb(186, 85, 211)"; break;
        case "Pb":
            markerColors[i]= "rgb(221, 160, 221)"; break;
        case "Pr":
            markerColors[i] ="rgb(255, 0, 255)"; break;
        case "Pt":
            markerColors[i]= "rgb(219, 112, 147)"; break;
        case "Rb":
            markerColors[i] = "rgb(255, 20, 147)";break;
        case "Re":
            markerColors[i]= "rgb(255, 182, 193)"; break;
        case "Rh":
            markerColors[i]= "rgb(255, 182, 0)"; break;
        case "Ru":
            markerColors[i]= "rgb(221, 160, 221)"; break;
        case "Sb":
            markerColors[i] ="rgb(255, 0, 255)"; break;
        case "Sc":
            markerColors[i]= "rgb(219, 112, 147)"; break;
        case "Sm":
            markerColors[i] = "rgb(255, 20, 147)";break;
        case "Sn":
            markerColors[i]= "rgb(255, 182, 193)"; break;
        case "Sr":
            markerColors[i]= "rgb(255, 182, 0)"; break;
        case "Tb":
            markerColors[i]= "rgb(221, 160, 221)"; break;
        case "Th":
            markerColors[i] ="rgb(255, 0, 255)"; break;
        case "Ti":
            markerColors[i]= "rgb(219, 112, 147)"; break;
        case "Tm":
            markerColors[i] = "rgb(255, 20, 147)";break;
        case "U":
            markerColors[i]= "rgb(255, 182, 193)"; break;
        case "V":
            markerColors[i]= "rgb(255, 182, 0)"; break;
        case "W":
            markerColors[i]= "rgb(221, 160, 221)"; break;
        case "Y":
            markerColors[i] ="rgb(255, 0, 255)"; break;
        case "Yb":
            markerColors[i]= "rgb(219, 112, 147)"; break;
        case "Zn":
            markerColors[i] = "rgb(255, 20, 147)";break;
        case "Zr":
            markerColors[i]= "rgb(255, 182, 193)"; break;
        case "NA":
            markerColors[i]= "rgb(220, 220, 220)"; break;
     }
 }
 //trace.showlegend = true;
 trace.marker.color = markerColors;
 trace.text = columnToArray(3);
 trace.name = "Metal 2";
}

  if (cValue == 9){
    markerNames = columnToArray(3);
    markerColors = new Array(markerNames.length);
    for (i=0; i<markerNames.length; i++){
      switch(markerNames[i]){
        case "F":
          markerColors[i]= "rgb(139, 0, 0)"; break;
      case "Cl":
          markerColors[i] = "rgb(220, 20, 60)";break;
      case "Br":
          markerColors[i]= "rgb(205, 92, 92)"; break;
      case "CN":
          markerColors[i]= "rgb(240, 128, 128)"; break;
      case "NO2":
          markerColors[i] ="rgb(255, 140, 0)"; break;
      case "NH2":
          markerColors[i]= "rgb(255, 215, 0)"; break;
      case "OH":
          markerColors[i] = "rgb(218, 165, 32)";break;
      case "COOH":
          markerColors[i]= "rgb(255, 255, 0)"; break;
      case "OCH3":
          markerColors[i]= "rgb(154, 205, 50)"; break;
      case "OCH2CH3":
          markerColors[i] ="rgb(107, 142, 35)"; break;
      case "OCH2CH2CH3":
          markerColors[i]= "rgb(0, 100, 0)"; break;
      case "CH3":
          markerColors[i] = "rgb(34, 139, 34)";break;
      case "CH2CH3":
          markerColors[i]= "rgb(50, 205, 50)"; break;
      case "CH2CH2CH3":
          markerColors[i]= "rgb(46, 139, 87)"; break;
      case "LONGER ALKYLS":
          markerColors[i]= "rgb(102, 205, 170)"; break;
      case "PERFLUOROALKANES":
          markerColors[i] = "rgb(60, 179, 113)";break;
      case "NA":
          markerColors[i]= "rgb(220, 220, 220)"; break;
   }
}
//trace.showlegend = true;
trace.marker.color = markerColors;
trace.text = columnToArray(3);
trace.name = "Functional Group";
}

  if (cValue == 10){
      markerNames = columnToArray(3);
      markerColors = new Array(markerNames.length);
      for (i=0; i<markerNames.length; i++){
          switch(markerNames[i]){
            case "0D":
           markerColors[i]= "rgb(139, 0, 0)"; break;
        case "1D":
            markerColors[i] = "rgb(220, 20, 60)";break;
        case "2D":
            markerColors[i]= "rgb(53, 95, 163)"; break;
        case "3D":
            markerColors[i]= "rgb(226, 150, 68)"; break;
        case "NA":
            markerColors[i] ="rgb(220, 220, 220)"; break;
          }
        }
  //trace.showlegend = true;
  trace.marker.color = markerColors;
  trace.text = columnToArray(3);
  trace.name = "Channel Dimensionality";
  }

  if (cValue == 11){
      markerNames = columnToArray(3);
      markerColors = new Array(markerNames.length);
      for (i=0; i<markerNames.length; i++){
          switch(markerNames[i]){
              case "SQUEEZE":
          markerColors[i]= "rgb(139, 0, 0)"; break;
              case "NO SQUEEZE":
          markerColors[i]= "rgb(226, 150, 68)"; break;
          }
      }
 //trace.showlegend = true;
 trace.marker.color = markerColors;
 trace.text = columnToArray(3);
 trace.name = "SQUEEZEd?";
   }

 if (cValue == 12){
    markerNames = columnToArray(3);
    markerColors = new Array(markerNames.length);
    for (i=0; i<markerNames.length; i++){
      switch(markerNames[i]){
        case "CHIRAL SPACE GROUP":
            markerColors[i]= "rgb(139, 0, 0)"; break;
        case "NON CHIRAL SPACE GROUP":
            markerColors[i]= "rgb(226, 150, 68)"; break;
        case "NA":
            markerColors[i] ="rgb(220, 220, 220)"; break;
     }
    }
    //trace.showlegend = true;
    trace.marker.color = markerColors;
    trace.text = columnToArray(3);
    trace.name = "In chiral space group?";
    }

 if (cValue == 13){
    markerNames = columnToArray(3);
    markerColors = new Array(markerNames.length);
    for (i=0; i<markerNames.length; i++){
        switch(markerNames[i]){
          case "CHIRAL ATOMS":
            markerColors[i]= "rgb(139, 0, 0)"; break;
          case "NA":
            markerColors[i] ="rgb(226, 150, 68)"; break;
          }
    }
    //trace.showlegend = true;
    trace.marker.color = markerColors;
    trace.text = columnToArray(3);
    trace.name = "Contain chiral atoms?";
  }

  if (cValue == 15){
     markerNames = columnToArray(3);
     markerColors = new Array(markerNames.length);
     for (i=0; i<markerNames.length; i++){
         switch(markerNames[i]){
           case "tetragonal":
               markerColors[i]= "rgb(139, 0, 0)"; break;
           case "orthorhombic":
               markerColors[i] ="rgb(226, 150, 68)"; break;
           case "monoclinic":
               markerColors[i]= "rgb(66, 134, 244)"; break;
           case "rhombohedral":
               markerColors[i] = "rgb(229, 66, 224)";break;
           case "triclinic":
               markerColors[i]= "rgb(50, 205, 50)"; break;
           case "hexagonal":
               markerColors[i]= "rgb(66, 220, 244)"; break;
           case "trigonal":
               markerColors[i]= "rgb(238, 244, 66)"; break;
           case "cubic":
               markerColors[i] = "rgb(60, 179, 113)";break;
           case "NA":
               markerColors[i]= "rgb(220, 220, 220)"; break;
           }
     }
     //trace.showlegend = true;
     trace.marker.color = markerColors;
     trace.text = columnToArray(3);
     trace.name = "Crystal System";
   }

  if (cValue == 16){
    markerNames = columnToArray(3);
    markerColors = new Array(markerNames.length);
    for (i=0; i<markerNames.length; i++){
        switch(markerNames[i]){
          case "Aba2":
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case "Acaa":
              markerColors[i] = "rgb(220, 20, 60)";break;
          case "Am":
              markerColors[i]= "rgb(205, 92, 92)"; break;
          case "C112/b":
              markerColors[i]= "rgb(240, 128, 128)"; break;
          case "C2":
              markerColors[i] ="rgb(255, 140, 0)"; break;
          case "C2/c":
              markerColors[i]= "rgb(255, 215, 0)"; break;
          case "C2/m":
              markerColors[i] = "rgb(218, 165, 32)";break;
          case "C222":
              markerColors[i]= "rgb(255, 255, 0)"; break;
          case "C2221":
              markerColors[i]= "rgb(154, 205, 50)"; break;
          case "C2cb":
              markerColors[i] ="rgb(107, 142, 35)"; break;
          case "Cc":
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case "Cc2m":
              markerColors[i] = "rgb(34, 139, 34)";break;
          case "Ccc2":
              markerColors[i]= "rgb(50, 205, 50)"; break;
          case "Ccca":
              markerColors[i]= "rgb(46, 139, 87)"; break;
          case "Cccm":
              markerColors[i]= "rgb(102, 205, 170)"; break;
          case "Cmc21":
              markerColors[i] = "rgb(60, 179, 113)";break;
          case "Cmca":
              markerColors[i]= "rgb(32, 178, 170)"; break;
          case "Cmcm":
              markerColors[i]= "rgb(47, 79, 79)"; break;
          case "Cmma":
              markerColors[i] ="rgb(0, 128, 128)"; break;
          case "Cmmm":
              markerColors[i]= "rgb(0, 255, 255)"; break;
          case "F222":
              markerColors[i] = "rgb(0, 206, 209)";break;
          case "F23":
              markerColors[i]= "rgb(64, 224, 208)"; break;
          case "F2dd":
              markerColors[i]= "rgb(127, 255, 212)"; break;
          case "F432":
              markerColors[i] ="rgb(176, 224, 230)"; break;
          case "F-43c":
              markerColors[i]= "rgb(95, 158, 160)"; break;
          case "F-43m":
              markerColors[i] = "rgb(70, 130, 180)";break;
          case "Fd-3":
              markerColors[i]= "rgb(0, 191, 255)"; break;
          case "Fd-3c":
              markerColors[i]= "rgb(30, 144, 255)"; break;
          case "Fd-3m":
              markerColors[i]= "rgb(25, 25, 112)"; break;
          case "Fdd2":
              markerColors[i] = "rgb(0, 10, 139)";break;
          case "Fddd":
              markerColors[i]= "rgb(0, 0, 255)"; break;
          case "Fm-3":
              markerColors[i]= "rgb(138, 43, 226)"; break;
          case "Fm-3c":
              markerColors[i] ="rgb(75, 0, 130)"; break;
          case "Fm3m":
              markerColors[i]= "rgb(139, 0, 139)"; break;
          case "Fm-3m":
              markerColors[i] = "rgb(148, 0, 211)";break;
          case "Fmmm":
              markerColors[i]= "rgb(186, 85, 211)"; break;
          case "I2":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "I2/a":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "I2/c":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "I2/m":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "I212121":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "I213":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "I222":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "I23":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "I2cb":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "I4":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "I-4":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "I4/m":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "I4/mcm":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "I4/mmm":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "I41":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "I41/a":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "I41/acd":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "I41/amd":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "I4122":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "I4132":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "I41cd":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "I41md":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "I-42d":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "I-42m":
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case "I432":
              markerColors[i] = "rgb(220, 20, 60)";break;
          case "I-43d":
              markerColors[i]= "rgb(205, 92, 92)"; break;
          case "I-43m":
              markerColors[i]= "rgb(240, 128, 128)"; break;
          case "I-4c2":
              markerColors[i] ="rgb(255, 140, 0)"; break;
          case "I4cm":
              markerColors[i]= "rgb(255, 215, 0)"; break;
          case "I-4m2":
              markerColors[i] = "rgb(218, 165, 32)";break;
          case "Ia":
              markerColors[i]= "rgb(255, 255, 0)"; break;
          case "Ia-3":
              markerColors[i]= "rgb(154, 205, 50)"; break;
          case "Ia3d":
              markerColors[i] ="rgb(107, 142, 35)"; break;
          case "Ia-3d":
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case "Iba2":
              markerColors[i] = "rgb(34, 139, 34)";break;
          case "Ibam":
              markerColors[i]= "rgb(50, 205, 50)"; break;
          case "Ibca":
              markerColors[i]= "rgb(46, 139, 87)"; break;
          case "Icab":
              markerColors[i]= "rgb(102, 205, 170)"; break;
          case "Im-3":
              markerColors[i] = "rgb(60, 179, 113)";break;
          case "Im-3m":
              markerColors[i]= "rgb(32, 178, 170)"; break;
          case "Ima2":
              markerColors[i]= "rgb(47, 79, 79)"; break;
          case "Imcm":
              markerColors[i] ="rgb(0, 128, 128)"; break;
          case "Imm2":
              markerColors[i]= "rgb(0, 255, 255)"; break;
          case "Imma":
              markerColors[i] = "rgb(0, 206, 209)";break;
          case "Immm":
              markerColors[i]= "rgb(64, 224, 208)"; break;
          case "P1":
              markerColors[i]= "rgb(127, 255, 212)"; break;
          case "P-1":
              markerColors[i] ="rgb(176, 224, 230)"; break;
          case "P2":
              markerColors[i]= "rgb(95, 158, 160)"; break;
          case "P2/c":
              markerColors[i] = "rgb(70, 130, 180)";break;
          case "P2/m":
              markerColors[i]= "rgb(0, 191, 255)"; break;
          case "P2/n":
              markerColors[i]= "rgb(30, 144, 255)"; break;
          case "P21":
              markerColors[i]= "rgb(25, 25, 112)"; break;
          case "P21/a":
              markerColors[i] = "rgb(0, 10, 139)";break;
          case "P21/c":
              markerColors[i]= "rgb(0, 0, 255)"; break;
          case "P21/m":
              markerColors[i]= "rgb(138, 43, 226)"; break;
          case "P21/n":
              markerColors[i] ="rgb(75, 0, 130)"; break;
          case "P21212":
              markerColors[i]= "rgb(139, 0, 139)"; break;
          case "P212121":
              markerColors[i] = "rgb(148, 0, 211)";break;
          case "P21221":
              markerColors[i]= "rgb(186, 85, 211)"; break;
          case "P213":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P22121":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P2221":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P3":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P-3":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P31":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P3112":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P321":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P31c":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P-31c":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P-31m":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P32":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P321":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P3212":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P3221":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P3c1":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P-3c1":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P-3m1":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P4":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P-4":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P4/mbm":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P4/mcc":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P4/mmm":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P4/mnc":
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case "P4/n":
              markerColors[i] = "rgb(220, 20, 60)";break;
          case "P4/nbm":
              markerColors[i]= "rgb(205, 92, 92)"; break;
          case "P4/ncc":
              markerColors[i]= "rgb(240, 128, 128)"; break;
          case "P4/nmm":
              markerColors[i] ="rgb(255, 140, 0)"; break;
          case "P4/nnc":
              markerColors[i]= "rgb(255, 215, 0)"; break;
          case "P41":
              markerColors[i] = "rgb(218, 165, 32)";break;
          case "P41212":
              markerColors[i]= "rgb(255, 255, 0)"; break;
          case "P4122":
              markerColors[i]= "rgb(154, 205, 50)"; break;
          case "P4132":
              markerColors[i] ="rgb(107, 142, 35)"; break;
          case "P42":
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case "P42/m":
              markerColors[i] = "rgb(34, 139, 34)";break;
          case "P42/mbc":
              markerColors[i]= "rgb(50, 205, 50)"; break;
          case "P42/mcm":
              markerColors[i]= "rgb(46, 139, 87)"; break;
          case "P42/mmc":
              markerColors[i]= "rgb(102, 205, 170)"; break;
          case "P42/mnm":
              markerColors[i] = "rgb(60, 179, 113)";break;
          case "P42/n":
              markerColors[i]= "rgb(32, 178, 170)"; break;
          case "P42/n":
              markerColors[i]= "rgb(47, 79, 79)"; break;
          case "P42/nbc":
              markerColors[i] ="rgb(0, 128, 128)"; break;
          case "P42/ncm":
              markerColors[i]= "rgb(0, 255, 255)"; break;
          case "P42/nmc":
              markerColors[i] = "rgb(0, 206, 209)";break;
          case "P42/nnm":
              markerColors[i]= "rgb(64, 224, 208)"; break;
          case "P4212":
              markerColors[i]= "rgb(127, 255, 212)"; break;
          case "P-421c":
              markerColors[i] ="rgb(176, 224, 230)"; break;
          case "P-421m":
              markerColors[i]= "rgb(95, 158, 160)"; break;
          case "P42212":
              markerColors[i] = "rgb(70, 130, 180)";break;
          case "P-42c":
              markerColors[i]= "rgb(0, 191, 255)"; break;
          case "P43":
              markerColors[i]= "rgb(30, 144, 255)"; break;
          case "P432":
              markerColors[i]= "rgb(25, 25, 112)"; break;
          case "P43212":
              markerColors[i] = "rgb(0, 10, 139)";break;
          case "P4322":
              markerColors[i]= "rgb(0, 0, 255)"; break;
          case "P4332":
              markerColors[i]= "rgb(138, 43, 226)"; break;
          case "P-43n":
              markerColors[i] ="rgb(75, 0, 130)"; break;
          case "P-4b2":
              markerColors[i]= "rgb(139, 0, 139)"; break;
          case "P4bm":
              markerColors[i] = "rgb(148, 0, 211)";break;
          case "P-4c2":
              markerColors[i]= "rgb(186, 85, 211)"; break;
          case "P4cc":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P-4n2":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P-6":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P6/m":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P6/mcc":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P6/mmm":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P61":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P6122":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P62":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P6222":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P-62c":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P-62m":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P63":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P63/m":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P63/mcm":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P63/mmc":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P6322":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P63cm":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "P63mc":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "P6422":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "P65":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "P6522":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "P-6c2":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "P6cc":
              markerColors[i]= "rgb(139, 0, 0)"; break;
          case "Pa3":
              markerColors[i] = "rgb(220, 20, 60)";break;
          case "Pa-3":
              markerColors[i]= "rgb(205, 92, 92)"; break;
          case "Pb21a":
              markerColors[i]= "rgb(240, 128, 128)"; break;
          case "Pba2":
              markerColors[i] ="rgb(255, 140, 0)"; break;
          case "Pbam":
              markerColors[i]= "rgb(255, 215, 0)"; break;
          case "Pban":
              markerColors[i] = "rgb(218, 165, 32)";break;
          case "Pbc21":
              markerColors[i]= "rgb(255, 255, 0)"; break;
          case "Pbca":
              markerColors[i]= "rgb(154, 205, 50)"; break;
          case "Pbcm":
              markerColors[i] ="rgb(107, 142, 35)"; break;
          case "Pbcn":
              markerColors[i]= "rgb(0, 100, 0)"; break;
          case "Pbnb":
              markerColors[i] = "rgb(34, 139, 34)";break;
          case "Pc":
              markerColors[i]= "rgb(50, 205, 50)"; break;
          case "Pc21b":
              markerColors[i]= "rgb(46, 139, 87)"; break;
          case "Pca21":
              markerColors[i]= "rgb(102, 205, 170)"; break;
          case "Pcab":
              markerColors[i] = "rgb(60, 179, 113)";break;
          case "Pcan":
              markerColors[i]= "rgb(32, 178, 170)"; break;
          case "Pcc2":
              markerColors[i]= "rgb(47, 79, 79)"; break;
          case "Pcca":
              markerColors[i] ="rgb(0, 128, 128)"; break;
          case "Pccm":
              markerColors[i]= "rgb(0, 255, 255)"; break;
          case "Pccn":
              markerColors[i] = "rgb(0, 206, 209)";break;
          case "Pcma":
              markerColors[i]= "rgb(64, 224, 208)"; break;
          case "Pcnb":
              markerColors[i]= "rgb(127, 255, 212)"; break;
          case "Pcnn":
              markerColors[i] ="rgb(176, 224, 230)"; break;
          case "Pm":
              markerColors[i]= "rgb(95, 158, 160)"; break;
          case "Pm3":
              markerColors[i] = "rgb(70, 130, 180)";break;
          case "Pm-3":
              markerColors[i]= "rgb(0, 191, 255)"; break;
          case "Pm-3m":
              markerColors[i]= "rgb(30, 144, 255)"; break;
          case "Pm-3n":
              markerColors[i]= "rgb(25, 25, 112)"; break;
          case "Pma2":
              markerColors[i] = "rgb(0, 10, 139)";break;
          case "Pmc21":
              markerColors[i]= "rgb(0, 0, 255)"; break;
          case "Pmma":
              markerColors[i]= "rgb(138, 43, 226)"; break;
          case "Pmmm":
              markerColors[i] ="rgb(75, 0, 130)"; break;
          case "Pmmn":
              markerColors[i]= "rgb(139, 0, 139)"; break;
          case "Pmn21":
              markerColors[i] = "rgb(148, 0, 211)";break;
          case "Pmna":
              markerColors[i]= "rgb(186, 85, 211)"; break;
          case "Pmnb":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Pmnn":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Pn":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Pn21a":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "Pn-3":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "Pn3m":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "Pn-3m":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Pn-3n":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Pna21":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Pnaa":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "Pnam":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "Pnan":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "Pnc2":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Pnma":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "Pnmm":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "Pnmn":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "Pnn2":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "Pnna":
              markerColors[i]= "rgb(255, 182, 0)"; break;
          case "Pnnm":
              markerColors[i]= "rgb(221, 160, 221)"; break;
          case "Pnnn":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "R3":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "R-3":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "R32":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "R3c":
              markerColors[i] ="rgb(255, 0, 255)"; break;
          case "R-3c":
              markerColors[i]= "rgb(219, 112, 147)"; break;
          case "R3m":
              markerColors[i] = "rgb(255, 20, 147)";break;
          case "R-3m":
              markerColors[i]= "rgb(255, 182, 193)"; break;
          case "#N/A":
              markerColors[i]= "rgb(220, 220, 220)"; break;
            }
      }
      //trace.showlegend = true;
      trace.marker.color = markerColors;
      trace.text = columnToArray(3);
      trace.name = "Space Group";
    }

    // Create a custom legend (or hide the legend if markerNames is null!)
    customLegend(markerNames, markerColors);

	var data = [trace];

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

// This function plots a custom legend for grouped data on the color axis
function customLegend(mNames, mColors){
  var legendID = document.getElementById("customLegend-modal");

  if (mNames != null){
    //console.log("Turning custom legend on.");
    // Get a list of the marker names and colors associated with them:
    markerNameList = uniq(mNames);
    markerColorList = [];
    for (i = 0; i < markerNameList.length; i++){
      nameLoc = mNames.indexOf(String(markerNameList[i]));
      markerColorList.push(mColors[nameLoc]);
    }

    // Make HTML for legend
    var htmlBlock = "<b>Color</b></br>";
    for (i = 0; i < markerNameList.length; i++){
      // Create each HTML entry
      var entry = "<span style='color:" + markerColorList[i] + "'>&#x25cf;</span> - " + markerNameList[i] + "</br>";
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
