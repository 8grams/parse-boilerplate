// cloud code
console.log("Load cloud code..");

Parse.Cloud.define("customFunction", async (request) => {
  console.log("Custom function here!");
});