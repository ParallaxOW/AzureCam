const PiCamera = require('pi-camera');
const azure = require("azure-storage");
const fs = require("fs");
const dateFormat = require("dateformat");
const config = require("./config.json");

var __dirName = config.dir_name;
if (!fs.existsSync(__dirName)){
    fs.mkdirSync(__dirName);
}

var __blobConnString = config.blob_conn_string;
console.log(__blobConnString);

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
 
myCamera.snap()
.then((result) => {
    // Your picture was captured
    blobService.createBlockBlobFromLocalFile('imagecontainer', 'imageblob', imageName, function(error, result, response) {
      if (!error) {
        console.log(`${imageName} Uploaded!`);
        var rmFile = fs.unlink(imageName);
      }else{
        console.log("File not uploaded!");
      }
    });
})
.catch((error) => {
     // Handle your error
});

function getImageName()
{
  var now = new Date();
  var formattedDate = dateFormat(now, "yyyymmdd_HHMMss");
  var fileName = `/image_${formattedDate}.jpg`;
  return fileName;
}