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

const button = new gpio(21, 'in',"rising");
const led = new gpio(17, "out");

var __blobConnString = config.blob_conn_string;
var blobService = azure.createBlobService(__blobConnString);
var imageName = `${__dirName}${getImageName()}`;

const myCamera = new PiCamera({
  mode: 'photo',
  output: imageName,
  width: 640,
  height: 480,
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
      // Your picture was captured
      blobService.createBlockBlobFromLocalFile('imagecontainer', 'imageblob', imageName, function(error, result, response) {
        if (!error) {
          console.log(`${imageName} Uploaded!`);
          //var rmFile = fs.unlink(imageName);
        }else{
          console.log("File not uploaded!");
        }
      });
  })
  .catch((error) => {
      // Handle your error
  });
  toggleLED(value);
}

function getImageName()
{
  var now = new Date();
  var formattedDate = dateFormat(now, "yyyymmdd_HHMMss");
  var fileName = `/image_${formattedDate}.jpg`;
  return fileName;
}

function exitHandler(){
  console.log("cleaning up...");
  button.unexport();
  console.log("buh-bye!");
}

process.on('exit', exitHandler.bind(null,null));