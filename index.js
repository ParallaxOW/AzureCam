const PiCamera = require('pi-camera');
const azure = require("azure-storage");
const fs = require("fs");
const dateFormat = require("dateformat");
const config = require("./config.json");

var __dirName = config.dir_name;
if (!fs.existsSync(__dirName)){
    fs.mkdirSync(__dirName);
}

//var blobService = azure.createBlobService();

const myCamera = new PiCamera({
  mode: 'photo',
  output: `${__dirName}${getImageName()}`,
  width: 640,
  height: 480,
  nopreview: true,
});
 
myCamera.snap()
.then((result) => {
    // Your picture was captured
})
.catch((error) => {
     // Handle your error
});

 
// blobService.createBlockBlobFromLocalFile('mycontainer', 'taskblob', 'task1-upload.txt', function(error, result, response) {
//   if (!error) {
//     // file uploaded
//   }
// });

function getImageName()
{
  var now = new Date();
  var formattedDate = dateFormat(now, "yyyymmdd_HHMMss");
  var fileName = `/image_${formattedDate}.jpg`;
  return fileName;

}