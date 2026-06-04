function getExchangeRates() {
  var rates = { usd: 0, eur: 0, uf: 0 };
  
  try {
    var usdHtml = UrlFetchApp.fetch("https://www.google.com/finance/quote/USD-CLP").getContentText();
    var matchUsd = usdHtml.match(/class="YMlKec fxKbKc"[^>]*>([\d,\.]+)</);
    if(matchUsd) rates.usd = parseFloat(matchUsd[1].replace(',', ''));
  } catch(e) {}
  
  try {
    var eurHtml = UrlFetchApp.fetch("https://www.google.com/finance/quote/EUR-CLP").getContentText();
    var matchEur = eurHtml.match(/class="YMlKec fxKbKc"[^>]*>([\d,\.]+)</);
    if(matchEur) rates.eur = parseFloat(matchEur[1].replace(',', ''));
  } catch(e) {}
  
  try {
    var ufResp = UrlFetchApp.fetch("https://mindicador.cl/api/uf");
    var ufJson = JSON.parse(ufResp.getContentText());
    rates.uf = ufJson.serie[0].valor;
  } catch(e) {}
  
  return rates;
}

function getBillingInfo(spreadsheet) {
  var configSheet = spreadsheet.getSheetByName("Config");
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet("Config");
    configSheet.getRange(1, 1).setValue("DATOS DE FACTURACIÓN");
    configSheet.getRange(1, 2).setValue("NOMBRE: MOVYON SPA AGENCIA EN CHILE SPA\nRUT: 76.416.097-5\nDIRECCION: A.BARROS ERRAZURIZ N°1954 OFICINA 1109 COMUNA PROVIDENCIA, CIUDAD SANTIAGO.\nCONTACTO: FELIPE.EDWARDS@MOVYON.COM ; GIOVANNI.DORE@MOVYON.COM");
  }
  return configSheet.getRange(1, 2).getValue().toString();
}

function setBillingInfo(spreadsheet, value) {
  var configSheet = spreadsheet.getSheetByName("Config");
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet("Config");
    configSheet.getRange(1, 1).setValue("DATOS DE FACTURACIÓN");
  }
  configSheet.getRange(1, 2).setValue(value);
}

function doGet(e) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  
  var finalResult = {
    records: result,
    rates: getExchangeRates(),
    billingInfo: getBillingInfo(spreadsheet)
  };
  
  var output = ContentService.createTextOutput(JSON.stringify(finalResult));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doPost(e) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    var data;
    
    // Parse json body. We use text/plain in client to avoid CORS preflight,
    // so we parse contents directly.
    data = JSON.parse(e.postData.contents);
    
    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    
    // Create new row data based on headers to ensure columns match
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      newRow.push(data[key] !== undefined ? data[key] : "");
    }
    
    var updated = false;
    // Check if Correlativo already exists
    if (data["Correlativo"]) {
      var searchCorrelativo = String(data["Correlativo"]).trim();
      for (var r = 1; r < sheetData.length; r++) {
        var sheetCorrelativo = String(sheetData[r][0]).trim();
        if (sheetCorrelativo === searchCorrelativo && searchCorrelativo !== "") {
          // Update existing row
          sheet.getRange(r + 1, 1, 1, newRow.length).setValues([newRow]);
          updated = true;
          break;
        }
      }
    }
    
    // If not updated, append new row
    if (!updated) {
      sheet.appendRow(newRow);
    }
    
    // Save billing info to the config sheet as well
    if (data["DATOS DE FACTURACIÓN:"]) {
      setBillingInfo(spreadsheet, data["DATOS DE FACTURACIÓN:"]);
    }
    
    var response = { "status": "success", "updated": updated, "correlativo": data["Correlativo"] };
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    var errorResponse = { "status": "error", "message": error.toString() };
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
  }
}
