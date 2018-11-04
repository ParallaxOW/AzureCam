console.log("starting up...");
console.log("gathering resources...");

const PiCamera = require('pi-camera');
const azure = require("azure-storage");
const fs = require("fs");
const dateFormat = require("dateformat");
const gpio = require("onoff").Gpio;
const config = require("./config.json");
const os = require("os");
const { analyzeImage } = require("./compvision");

var __dirName = config.dir_name;
if (!fs.existsSync(__dirName)){
    fs.mkdirSync(__dirName);
}
//pin number, direction, button press to catch.  
//In this case we want to catch only one instance of the press, so either rising (press) or falling (release)
//debounce timeout takes care of hardware jitters (hardware thinks button was pressed multiple times.)
console.log("allocating hardware...")
const button = new gpio(21, 'in',"rising",{debounceTimeout: 10});
const camSnapLED = new gpio(17, "out");
const analyzeLED = new gpio(27, "out");

console.log("allocating virtual resources...");
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

console.log("setup complete.  waiting for button presses...");
button.watch((err, value) => captureAndUploadImage(value));

/*************    functions  ******************/

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

  //metadata object for the blob.
  var options = {};

  myCamera.snap()
  .then(async (result) => {
      //we'll rename the snapped pic, since we can't dynamically reset the cam output name.
      fs.renameSync(camOutputName, pathName);

      //if we marked in config to analyze the images lets do it!
      if(config.analyze_images){
        console.log("analyzing...");
        toggleLED(analyzeLED);
        //this builds the call to AzCogSvcs we'll await/then/catch here so we can act on the results.
        await analyzeImage(pathName)
          .then((response) => {
              console.log(response.body);

              options = {metadata: 
                  {
                    "location_name": `${config.location_name}`, 
                    "analysis_description":response.body.description.tags.toString()
                  }
                };

          }).catch((err) => {
              console.log(err);

              options = {metadata: 
                  {
                    "location_name": `${config.location_name}`, 
                    "analysis_error": err
                  }
                };
          });

        toggleLED(analyzeLED);
      }
      else{
        options = {metadata: {"locationName": `${config.location_name}`}};
      }

      //we're handing in an options object so we can mark the image with some useful metadata
      blobService.createBlockBlobFromLocalFile('imagecontainer', imageName, pathName, options, function(error, result, response) {
        if (!error) {
          console.log(`${imageName} Uploaded!`);
          toggleLED(camSnapLED);

          
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
  console.log("deallocating leds...");
  camSnapLED.unexport();
  analyzeLED.unexport();
  console.log("deallocating button...");
  button.unexport();
  console.log("all done!  buh-bye!");
  process.exit(0);
}

process.on('SIGINT', exitHandler.bind(null, null));