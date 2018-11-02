const PiCamera = require('pi-camera');
const azure = require("azure-storage");
const fs = require("fs");
const dateFormat = require("dateformat");
const gpio = require("onoff").Gpio;
const config = require("./config.json");

const { analyzeImage } = require("./compvision");

var __dirName = config.dir_name;
if (!fs.existsSync(__dirName)){
    fs.mkdirSync(__dirName);
}
//pin number, direction, button press to catch.  
//In this case we want to catch only one instance of the press, so either rising (press) or falling (release)
//debounce timeout takes care of hardware jitters (hardware thinks button was pressed multiple times.)
const button = new gpio(21, 'in',"rising",{debounceTimeout: 10});
const camSnapLED = new gpio(17, "out");
const analyzeLED = new gpio(27, "out");

var __blobConnString = config.blob_conn_string;
var blobService = azure.createBlobService(__blobConnString);
var imageName = "";
var pathName = "";
var camOutputName = "./images/camsnap.jpg";

const myCamera = new PiCamera({
  mode: 'photo',
  output: camOutputName,
  width: 2592, 
  height: 1944,
  nopreview: true,
  rotation: 180
});

console.log("waiting for button presses...");
button.watch((err, value) => captureAndUploadImage(value));

function toggleLED(whichLed){
  if(whichLed.readSync() === 0)
    whichLed.writeSync(1);
  else
    whichLed.writeSync(0);
}

function generateFileName(){
  imageName = getImageName();
  pathName = `${__dirName}/${imageName}`;
}

function ensureLightsOut(){
  if(camSnapLED.readSync() === 1)
    toggleLED(camSnapLED);

  if(analyzeLED.readSync() === 1)
    toggleLED(analyzeLED);
}

function captureAndUploadImage(value){
  console.log("capturing and uploading image....");
  generateFileName();

  myCamera.output = pathName;

  toggleLED(camSnapLED);
  myCamera.snap()
  .then((result) => {
      //we'll rename the snapped pic, since we can't dynamically reset the cam output name.
      fs.renameSync(camOutputName, pathName);

      blobService.createBlockBlobFromLocalFile('imagecontainer', imageName, pathName, function(error, result, response) {
        if (!error) {
          console.log(`${imageName} Uploaded! analyzing...`);
          toggleLED(camSnapLED);
          toggleLED(analyzeLED);
          analyzeImage(pathName);
          toggleLED(analyzeLED);
        }else{
          console.log(`File not uploaded :: ${error}`);
          ensureLightsOut();
        }
      });
  })
  .catch((error) => {
      console.log(error);
      ensureLightsOut();
  });
}

function getImageName()
{
  var fileName = `image_${getFormattedDate()}.jpg`;
  return fileName;
}

function getFormattedDate(){
  var now = new Date();
  var formattedDate = dateFormat(now, "yyyymmdd_HHMMss");
  return formattedDate;
}

function exitHandler(){
  console.log("cleaning up...");
  console.log("deallocating led...");
  led.unexport();
  console.log("deallocating button...");
  button.unexport();
  console.log("all done!  buh-bye!");
  process.exit(0);
}

process.on('SIGINT', exitHandler.bind(null, null));