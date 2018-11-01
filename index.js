const PiCamera = require('pi-camera');
const azure = require("azure-storage");
const fs = require("fs");
const dateFormat = require("dateformat");
const gpio = require("onoff").Gpio;
const config = require("./config.json");

var __dirName = config.dir_name;
if (!fs.existsSync(__dirName)){
    fs.mkdirSync(__dirName);
}
//pin number, direction, button press to catch.  
//In this case we want to catch only one instance of the press, so either rising (press) or falling (release)
//debounce timeout takes care of hardware jitters (hardware thinks button was pressed multiple times.)
const button = new gpio(21, 'in',"rising",{debounceTimeout: 10});
const led = new gpio(17, "out");

var __blobConnString = config.blob_conn_string;
var blobService = azure.createBlobService(__blobConnString);
var imageName = `${__dirName}${getImageName()}`;

const myCamera = new PiCamera({
  mode: 'photo',
  output: imageName,
  width: 2592, 
  height: 1944,
  nopreview: true,
  rotation: 180
});

console.log("waiting for button presses...");
button.watch((err, value) => captureAndUploadImage(value));

function toggleLED(value){
  if(led.readSync() === 0)
    led.writeSync(1);
  else
    led.writeSync(0);
}

function captureAndUploadImage(value){
  console.log("capturing and uploading image....");
  toggleLED(value);
  myCamera.snap()
  .then((result) => {
      blobService.createBlockBlobFromLocalFile('imagecontainer', getImageName(), imageName, function(error, result, response) {
        if (!error) {
          console.log(`${imageName} Uploaded!`);
        }else{
          console.log("File not uploaded!");
        }
      });
      toggleLED(value);
  })
  .catch((error) => {
      console.log(error);
      toggleLED(value);
  });
}

function getImageName()
{
  var fileName = `/image_${getFormattedDate()}.jpg`;
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